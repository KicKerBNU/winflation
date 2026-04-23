import { GoogleGenAI } from '@google/genai'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { randomUUID } from 'node:crypto'

const geminiKey = process.env.GEMINI_API_KEY
const firebaseJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT

if (!geminiKey?.trim()) {
  throw new Error('Missing GEMINI_API_KEY secret.')
}
if (!firebaseJsonRaw?.trim()) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT secret.')
}

let serviceAccount
try {
  serviceAccount = JSON.parse(firebaseJsonRaw)
} catch (err) {
  throw new Error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`)
}

const storageBucketName =
  process.env.FIREBASE_STORAGE_BUCKET?.trim() || `${serviceAccount.project_id}.firebasestorage.app`

initializeApp({ credential: cert(serviceAccount), storageBucket: storageBucketName })
const db = getFirestore()
const bucket = getStorage().bucket()
const ai = new GoogleGenAI({ apiKey: geminiKey })

function stripFences(text) {
  let t = text
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return t
}

function safeTicker(ticker) {
  return String(ticker).replace(/[^A-Za-z0-9._-]/g, '_').toUpperCase()
}

function extFromContentType(ct) {
  if (!ct) return 'png'
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'png'
}

function buildFirebaseDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
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

async function fetchLatestCompanies() {
  const snap = await db.collection('ai-recommendations').doc('latest').get()
  if (!snap.exists) throw new Error('Document ai-recommendations/latest not found.')
  const data = snap.data()
  const companies = Array.isArray(data?.companies) ? data.companies : []
  if (companies.length === 0) throw new Error('No companies in ai-recommendations/latest.')
  return { data, companies }
}

async function readCachedLogoUrl(ticker) {
  const snap = await db.collection('logos').doc(safeTicker(ticker)).get()
  if (!snap.exists) return null
  return snap.data()?.logoUrl || null
}

async function fetchLogoSuggestions(companies) {
  const list = companies
    .map((c) => `- ${c.ticker} | ${c.company} | website: ${c.website || 'unknown'}`)
    .join('\n')
  const prompt = `For each company below, return its official website domain and the logo URL.

Requirements:
- website must be root domain only, without protocol (example: enel.com).
- logoUrl should prefer Clearbit format using that domain: https://logo.clearbit.com/<domain>
- Prefer PNG or SVG with transparent background.
- Prefer Wikimedia Commons (upload.wikimedia.org) or the company's own static asset CDN.
- The URL must return the image directly (not an HTML page).
- Return ONLY raw JSON, no markdown, no explanation:
[{"ticker":"<ticker>","website":"company.com","logoUrl":"https://..."}]

Companies:
${list}`

  const raw = await callGeminiWithRetry(prompt)
  const parsed = JSON.parse(stripFences(raw))
  return Array.isArray(parsed) ? parsed : []
}

async function storeLogo(ticker, sourceUrl) {
  let res = null
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(sourceUrl, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; winflation-logo-bot/1.0)',
        accept: 'image/*,*/*;q=0.8',
      },
    })
    if (res.ok) break
    if (res.status !== 429 && res.status < 500) break
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
  }
  if (!res?.ok) throw new Error(`fetch ${res?.status ?? 'failed'}`)
  const ct = (res.headers.get('content-type') || 'image/png').split(';')[0].trim()
  if (!ct.startsWith('image/')) throw new Error(`non-image content-type ${ct}`)

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
    throw new Error(`invalid image size ${buf.length}`)
  }

  const safe = safeTicker(ticker)
  let logoUrl = sourceUrl
  let storedInStorage = false
  try {
    const objectPath = `logos/${safe}.${extFromContentType(ct)}`
    const token = randomUUID()
    await bucket.file(objectPath).save(buf, {
      contentType: ct,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    })
    logoUrl = buildFirebaseDownloadUrl(bucket.name, objectPath, token)
    storedInStorage = true
  } catch (err) {
    console.warn(`[logos] ${ticker}: storage upload failed, using source URL (${err.message})`)
  }

  await db.collection('logos').doc(safe).set({
    ticker,
    logoUrl,
    sourceUrl,
    contentType: ct,
    sizeBytes: buf.length,
    storedInStorage,
    updatedAt: new Date().toISOString(),
  })

  return logoUrl
}

function logoCandidatesForCompany(company, geminiUrl) {
  const candidates = []
  if (geminiUrl) candidates.push(geminiUrl)
  if (company?.website) {
    const clean = String(company.website).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    if (clean) {
      candidates.push(`https://logo.clearbit.com/${clean}`)
      candidates.push(`https://www.google.com/s2/favicons?sz=256&domain=${encodeURIComponent(clean)}`)
      candidates.push(`https://icons.duckduckgo.com/ip3/${clean}.ico`)
      candidates.push(`https://${clean}/favicon.ico`)
      candidates.push(`https://www.${clean}/favicon.ico`)
      candidates.push(`https://www.${clean}`)
    }
  }
  return [...new Set(candidates)]
}

async function resolveLogos(companies) {
  const cached = {}
  for (const company of companies) {
    const url = await readCachedLogoUrl(company.ticker)
    if (url) cached[safeTicker(company.ticker)] = url
  }

  const missing = companies.filter((c) => !cached[safeTicker(c.ticker)])
  const resolved = {}

  if (missing.length > 0) {
    const chunks = []
    const size = 10
    for (let i = 0; i < missing.length; i += size) chunks.push(missing.slice(i, i + size))

    for (const chunk of chunks) {
      let suggestions = []
      try {
        suggestions = await fetchLogoSuggestions(chunk)
      } catch (err) {
        console.warn(`[logos] Gemini parse failed for chunk: ${err.message}`)
        continue
      }

      for (const item of suggestions) {
        if (!item?.ticker || !item?.logoUrl) continue
        const key = safeTicker(item.ticker)
        const company = chunk.find((c) => safeTicker(c.ticker) === key) || {}
        const website =
          item.website && typeof item.website === 'string' ? item.website : company.website || null
        const candidates = logoCandidatesForCompany({ ...company, website }, item.logoUrl)
        try {
          let done = false
          for (const candidate of candidates) {
            try {
              const logoUrl = await storeLogo(item.ticker, candidate)
              resolved[key] = logoUrl
              done = true
              console.log(`[logos] ${item.ticker}: stored -> ${logoUrl}`)
              break
            } catch (err) {
              console.warn(`[logos] ${item.ticker}: ${candidate} failed (${err.message})`)
            }
          }
          if (!done) {
            console.warn(`[logos] ${item.ticker}: all candidates failed`)
          }
        } catch {
          console.warn(`[logos] ${item.ticker}: could not resolve`)
        }
      }
    }
  }

  let updated = 0
  for (const company of companies) {
    const key = safeTicker(company.ticker)
    const url = cached[key] || resolved[key]
    if (url && company.logoUrl !== url) {
      company.logoUrl = url
      updated++
    }
  }

  console.log(
    `[logos] updated ${updated}/${companies.length} company logos (cached: ${Object.keys(cached).length}, new: ${Object.keys(resolved).length})`,
  )
}

const { data, companies } = await fetchLatestCompanies()
console.log(`[${new Date().toISOString()}] Loaded ${companies.length} companies from ai-recommendations/latest`)

await resolveLogos(companies)

await db
  .collection('ai-recommendations')
  .doc('latest')
  .set(
    {
      ...data,
      companies,
      logosUpdatedAt: new Date().toISOString(),
    },
    { merge: true },
  )

console.log(`[${new Date().toISOString()}] Finished logo sync`)
