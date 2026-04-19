import { GoogleGenAI } from '@google/genai'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const geminiKey = process.env.GEMINI_API_KEY
const firebaseJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT

if (!geminiKey?.trim()) {
  throw new Error(
    'Missing GEMINI_API_KEY: add repository secret GEMINI_API_KEY (see .github/workflows/ai-daily-recommendations.yml).',
  )
}
if (!firebaseJsonRaw?.trim()) {
  throw new Error(
    'Missing FIREBASE_SERVICE_ACCOUNT: add the Firebase Admin service account JSON as repository secret FIREBASE_SERVICE_ACCOUNT (Firebase Console → Project settings → Service accounts → Generate new private key).',
  )
}

let serviceAccount
try {
  serviceAccount = JSON.parse(firebaseJsonRaw)
} catch (err) {
  throw new Error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`)
}

const storageBucketName =
  process.env.FIREBASE_STORAGE_BUCKET?.trim() || `${serviceAccount.project_id}.firebasestorage.app`

// Init Firebase Admin
initializeApp({ credential: cert(serviceAccount), storageBucket: storageBucketName })
const db = getFirestore()
const bucket = getStorage().bucket()

// Init Gemini
const ai = new GoogleGenAI({ apiKey: geminiKey })

async function fetchEcbDepositRate() {
  const url =
    'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=1'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ECB API error: ${res.status}`)
  const data = await res.json()
  const series = Object.values(data.dataSets[0].series)[0]
  const obs = Object.values(series.observations)[0]
  return obs[0]
}

async function callGeminiWithRetry(prompt) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt })
      return (res.text ?? '').trim()
    } catch (err) {
      const isRateLimit = err instanceof Error && err.message.includes('429')
      if (!isRateLimit || attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
    }
  }
  return ''
}

function stripFences(text) {
  let t = text
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return t
}

function safeTicker(t) {
  return String(t).replace(/[^A-Za-z0-9._-]/g, '_').toUpperCase()
}

function extFromContentType(ct) {
  if (!ct) return 'png'
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'png'
}

async function resolveLogos(companies) {
  // 1. Check Firestore cache (logos collection accumulates over time, independent of daily rotation)
  const cached = {}
  await Promise.all(
    companies.map(async (c) => {
      const snap = await db.collection('logos').doc(safeTicker(c.ticker)).get()
      const url = snap.exists ? snap.data()?.logoUrl : null
      if (url) cached[c.ticker] = url
    }),
  )

  const missing = companies.filter((c) => !cached[c.ticker])
  const resolved = {}

  if (missing.length > 0) {
    const list = missing
      .map((c) => `- ${c.ticker} | ${c.company} | website: ${c.website || 'unknown'}`)
      .join('\n')
    const logoPrompt = `For each European company below, return the single best public URL to its official logo.

Requirements:
- Prefer PNG or SVG with transparent background.
- Prefer Wikimedia Commons (upload.wikimedia.org) or the company's own static asset CDN.
- The URL must return the image directly (not an HTML page).
- Return ONLY raw JSON, no markdown, no explanation:
[{"ticker":"<ticker>","logoUrl":"https://..."}]

Companies:
${list}`

    const raw = await callGeminiWithRetry(logoPrompt)
    let suggestions = []
    try {
      suggestions = JSON.parse(stripFences(raw))
    } catch (err) {
      console.warn('[logos] Failed to parse Gemini logo response:', raw.slice(0, 300))
    }

    for (const item of Array.isArray(suggestions) ? suggestions : []) {
      if (!item?.ticker || !item?.logoUrl) continue
      try {
        const res = await fetch(item.logoUrl, { redirect: 'follow' })
        if (!res.ok) {
          console.warn(`[logos] ${item.ticker}: fetch ${res.status} from ${item.logoUrl}`)
          continue
        }
        const ct = (res.headers.get('content-type') || 'image/png').split(';')[0].trim()
        if (!ct.startsWith('image/')) {
          console.warn(`[logos] ${item.ticker}: non-image content-type ${ct}`)
          continue
        }
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
          console.warn(`[logos] ${item.ticker}: skipping (size ${buf.length})`)
          continue
        }
        const safe = safeTicker(item.ticker)
        const objectPath = `logos/${safe}.${extFromContentType(ct)}`
        const file = bucket.file(objectPath)
        await file.save(buf, {
          contentType: ct,
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        })
        await file.makePublic()
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`
        await db.collection('logos').doc(safe).set({
          ticker: item.ticker,
          logoUrl: publicUrl,
          sourceUrl: item.logoUrl,
          contentType: ct,
          sizeBytes: buf.length,
          updatedAt: new Date().toISOString(),
        })
        resolved[item.ticker] = publicUrl
        console.log(`[logos] ${item.ticker}: stored ${buf.length}B → ${publicUrl}`)
      } catch (err) {
        console.warn(`[logos] ${item.ticker}: ${err.message}`)
      }
    }
  }

  let hits = 0
  for (const c of companies) {
    const url = cached[c.ticker] || resolved[c.ticker]
    if (url) {
      c.logoUrl = url
      hits++
    }
  }
  console.log(
    `[logos] resolved ${hits}/${companies.length} (cached: ${Object.keys(cached).length}, new: ${Object.keys(resolved).length})`,
  )
}

const now = new Date()
const today = now.toISOString().split('T')[0]
const currentYear = now.getUTCFullYear()
const lastCompleteYear = currentYear - 1
const firstYear = lastCompleteYear - 4
const targetYears = Array.from({ length: 5 }, (_, i) => firstYear + i)
const excludedYearCeiling = firstYear - 1

const ecbDepositRate = await fetchEcbDepositRate()
const minYield = +(ecbDepositRate * 2).toFixed(2)
console.log(
  `[${new Date().toISOString()}] ECB deposit rate: ${ecbDepositRate}% — enforcing min dividend yield of ${minYield}% (2× ECB).`,
)

const exampleHistoricYields = targetYears
  .map((y, i) => `        { "year": ${y}, "yield": ${(5.8 + i * 0.35).toFixed(2)}, "dividend": ${(0.35 + i * 0.035).toFixed(3)} }`)
  .join(',\n')
const exampleDividendsPerYear = targetYears
  .map((y, i) => `        { "year": ${y}, "totalAmount": ${(0.35 + i * 0.035).toFixed(3)}, "payments": 2 }`)
  .join(',\n')

const prompt = `You are a financial data analyst specializing in European equity markets.

CURRENT DATE: ${today}
CURRENT YEAR: ${currentYear}
LAST COMPLETE CALENDAR YEAR: ${lastCompleteYear}
TARGET HISTORIC YEARS (exactly these 5, oldest to newest): ${targetYears.join(', ')}

Return ONLY a raw JSON object. No markdown, no code fences, no explanation — just the JSON.

The JSON must follow this exact schema:
{
  "generatedAt": "<ISO-8601 datetime string for now>",
  "companies": [
    {
      "rank": 1,
      "ticker": "ENEL.MI",
      "company": "Enel SpA",
      "country": "Italy",
      "countryCode": "IT",
      "sector": "Utilities",
      "exchange": "Borsa Italiana",
      "currency": "EUR",
      "currentPrice": 6.85,
      "dividendYield": 7.2,
      "annualDividend": 0.49,
      "marketCap": 70000000000,
      "priceChangePercent": 0.3,
      "historicYields": [
${exampleHistoricYields}
      ],
      "dividendsPerYear": [
${exampleDividendsPerYear}
      ],
      "status": "bullish",
      "pro": {
        "en-US": "One sentence in English explaining the main investment strength.",
        "pt-BR": "Same sentence in Brazilian Portuguese.",
        "fr-FR": "Same sentence in French.",
        "it-IT": "Same sentence in Italian.",
        "es-ES": "Same sentence in Spanish."
      },
      "con": {
        "en-US": "One sentence in English explaining the main investment risk.",
        "pt-BR": "Same sentence in Brazilian Portuguese.",
        "fr-FR": "Same sentence in French.",
        "it-IT": "Same sentence in Italian.",
        "es-ES": "Same sentence in Spanish."
      }
    }
  ]
}

Select the top 10 European large-cap companies by dividend yield as of ${today}. Prioritize:
- Companies listed on major EU exchanges: Euronext (Paris/Amsterdam/Brussels), XETRA, Borsa Italiana, BME Spain, Nasdaq Nordic.
- Sustainable, well-established dividend payers in Utilities, Financials, Energy, Telecoms, Insurance, Consumer Staples.
- Large caps with market caps above €5B.
- Rank 1 = highest dividend yield.
- Include companies from diverse countries (France, Germany, Italy, Spain, Netherlands, etc.).

YIELD THRESHOLD (HARD REQUIREMENT — ABSOLUTE):
- The ECB deposit facility rate is currently ${ecbDepositRate}%.
- Every company's current dividendYield MUST be STRICTLY GREATER THAN ${minYield}% (which is 2× the ECB deposit rate).
- Do NOT include any company with dividendYield ≤ ${minYield}%. If a candidate's yield is not clearly above ${minYield}%, exclude it and pick a different one.
- Prefer candidates with yield comfortably above ${minYield}% (e.g. 5%+) to leave headroom.

RECENCY CONSTRAINTS (CRITICAL — do NOT ignore):
- currentPrice, dividendYield, annualDividend, marketCap MUST reflect values as of ${today}, using the most recent data you have. Use your best estimate of ${currentYear} values — do NOT default to values from ${excludedYearCeiling} or earlier.
- historicYields MUST contain exactly 5 entries, one for each of these years in order: ${targetYears.join(', ')}. The most recent entry MUST be year ${lastCompleteYear}.
- dividendsPerYear MUST contain exactly 5 entries for the same years: ${targetYears.join(', ')}. The most recent entry MUST be year ${lastCompleteYear}.
- Do NOT output any historic entry with year ≤ ${excludedYearCeiling}. Do NOT output entries for ${currentYear} (year not yet complete).
- The "status" field reflects the investment outlook as of ${today}.`

console.log(`[${new Date().toISOString()}] Calling Gemini API...`)

const text = stripFences(await callGeminiWithRetry(prompt))

let data
try {
  data = JSON.parse(text)
} catch (err) {
  console.error('Failed to parse Gemini response:', text.slice(0, 500))
  throw new Error(`JSON parse error: ${err.message}`)
}

if (!Array.isArray(data.companies) || data.companies.length === 0) {
  throw new Error('Invalid response: missing companies array')
}

// Defensive yield filter — drop anything Gemini returned below the 2× ECB threshold.
const beforeCount = data.companies.length
data.companies = data.companies
  .filter((c) => typeof c.dividendYield === 'number' && c.dividendYield > minYield)
  .sort((a, b) => b.dividendYield - a.dividendYield)
  .map((c, i) => ({ ...c, rank: i + 1 }))

if (data.companies.length === 0) {
  throw new Error(
    `All ${beforeCount} returned companies had yield ≤ ${minYield}%. Gemini ignored the yield threshold — not saving.`,
  )
}
if (data.companies.length < beforeCount) {
  console.warn(
    `[yield-filter] Dropped ${beforeCount - data.companies.length}/${beforeCount} companies below ${minYield}% and re-ranked.`,
  )
}

// Ensure generatedAt is present
data.generatedAt = data.generatedAt ?? new Date().toISOString()

console.log(`[${new Date().toISOString()}] Received ${data.companies.length} companies. Resolving logos...`)

await resolveLogos(data.companies)

console.log(`[${new Date().toISOString()}] Saving to Firestore...`)

await db.collection('ai-recommendations').doc('latest').set(data)

console.log(`[${new Date().toISOString()}] Done. Top pick: ${data.companies[0]?.company} @ ${data.companies[0]?.dividendYield}% yield`)
