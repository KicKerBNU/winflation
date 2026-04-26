// One-time bulk logo fetch for the SPINE list.
//
// For every ticker in scripts/eu-dividend-universe.mjs:
//   1. Skip if public/logos/<TICKER>.<ext> already exists (unless --force).
//   2. Resolve the company's website domain via Yahoo profile.
//   3. Try logo URL candidates in priority order:
//        Gemini suggestion → Clearbit → Google favicon → DuckDuckGo favicon
//   4. Validate (image content-type, size ≤ 2 MB) and write to public/logos/.
//   5. Update Firestore logos/<TICKER> with the resulting URL.
//
// After running, commit `public/logos/*` and push — Netlify rebuilds and the
// logos serve from /logos/<TICKER>.<ext>.
//
// Usage (from project root):
//   node --env-file=.env.local scripts/bulk-fetch-spine-logos.mjs           # skip existing
//   node --env-file=.env.local scripts/bulk-fetch-spine-logos.mjs --force   # redo all
import { SPINE } from './eu-dividend-universe.mjs'
import { GoogleGenAI } from '@google/genai'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import YahooFinance from 'yahoo-finance2'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const force = process.argv.includes('--force')

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
const geminiKey =
  process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || ''
const firebaseJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT

if (!geminiKey) {
  console.error('Missing GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in env.')
  process.exit(1)
}
if (!firebaseJsonRaw?.trim()) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT in env.')
  process.exit(1)
}

let serviceAccount
try {
  serviceAccount = JSON.parse(firebaseJsonRaw)
} catch (err) {
  console.error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`)
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const ai = new GoogleGenAI({ apiKey: geminiKey })

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logosDir = resolve(projectRoot, 'public', 'logos')
mkdirSync(logosDir, { recursive: true })

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
function stripFences(text) {
  let t = text
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return t
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

function existingLogoFile(safeT) {
  try {
    const files = readdirSync(logosDir)
    return files.find((f) => f.toUpperCase().startsWith(`${safeT}.`)) ?? null
  } catch {
    return null
  }
}

async function fetchDomainFromYahoo(ticker) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'price'] })
    const website = summary.summaryProfile?.website
    if (!website) return { website: null, name: summary.price?.longName ?? summary.price?.shortName ?? ticker }
    const clean = String(website).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/')[0]
    return { website: clean || null, name: summary.price?.longName ?? summary.price?.shortName ?? ticker }
  } catch (err) {
    console.warn(`[yahoo-profile] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return { website: null, name: ticker }
  }
}

async function fetchLogoSuggestions(items) {
  // items: [{ ticker, name, website }]
  const list = items
    .map((c) => `- ${c.ticker} | ${c.name} | website: ${c.website || 'unknown'}`)
    .join('\n')
  const prompt = `For each European company below, return the single best public URL to its official logo.

Requirements:
- Prefer PNG or SVG with transparent background.
- Prefer Wikimedia Commons (upload.wikimedia.org) or the company's own static asset CDN.
- The URL must return the image directly (not an HTML page).
- Return ONLY raw JSON, no markdown:
[{"ticker":"<ticker>","logoUrl":"https://..."}]

Companies:
${list}`
  try {
    const raw = stripFences(await callGeminiWithRetry(prompt))
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn(`[gemini] suggestion parse failed: ${err.message}`)
    return []
  }
}

function logoCandidates(geminiUrl, website) {
  const out = []
  if (geminiUrl) out.push(geminiUrl)
  if (website) {
    out.push(`https://logo.clearbit.com/${website}`)
    out.push(`https://www.google.com/s2/favicons?sz=256&domain=${encodeURIComponent(website)}`)
    out.push(`https://icons.duckduckgo.com/ip3/${website}.ico`)
  }
  return Array.from(new Set(out))
}

async function downloadAndValidate(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; winflation-logo-bot/1.0)',
      accept: 'image/*,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = (res.headers.get('content-type') || 'image/png').split(';')[0].trim()
  if (!ct.startsWith('image/')) throw new Error(`non-image content-type ${ct}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
    throw new Error(`invalid image size ${buf.length}`)
  }
  return { buf, ct }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(`[bulk-logos] SPINE size: ${SPINE.length}. Force: ${force}.`)

// 1. Find tickers we still need to fetch
const needFetch = []
const skipped = []
for (const ticker of SPINE) {
  const safe = safeTicker(ticker)
  const existing = existingLogoFile(safe)
  if (existing && !force) {
    skipped.push({ ticker, file: existing })
    continue
  }
  needFetch.push(ticker)
}
console.log(`[bulk-logos] Skipping ${skipped.length} (already present). Fetching ${needFetch.length}.`)

if (needFetch.length === 0) {
  console.log('[bulk-logos] Nothing to do. Exiting.')
  process.exit(0)
}

// 2. Resolve domains via Yahoo for the ones we need
console.log('[bulk-logos] Resolving company domains via Yahoo…')
const domainResolved = await Promise.all(
  needFetch.map(async (ticker) => {
    const info = await fetchDomainFromYahoo(ticker)
    return { ticker, ...info }
  }),
)

// 3. Ask Gemini for suggestions (chunks of 10 to keep prompts focused)
const geminiSuggestions = new Map() // ticker → URL
const chunkSize = 10
for (let i = 0; i < domainResolved.length; i += chunkSize) {
  const chunk = domainResolved.slice(i, i + chunkSize)
  console.log(`[bulk-logos] Gemini chunk ${i / chunkSize + 1}/${Math.ceil(domainResolved.length / chunkSize)} (${chunk.length} tickers)…`)
  const suggestions = await fetchLogoSuggestions(chunk)
  for (const s of suggestions) {
    if (s.ticker && s.logoUrl) geminiSuggestions.set(s.ticker.toUpperCase(), s.logoUrl)
  }
}

// 4. For each needed ticker: try candidates in order, save first success
const successes = []
const failures = []
for (const item of domainResolved) {
  const safe = safeTicker(item.ticker)
  const geminiUrl = geminiSuggestions.get(safe) || geminiSuggestions.get(item.ticker)
  const candidates = logoCandidates(geminiUrl, item.website)
  if (candidates.length === 0) {
    failures.push({ ticker: item.ticker, reason: 'no candidates (no website, no Gemini suggestion)' })
    continue
  }

  let saved = false
  for (const url of candidates) {
    try {
      const { buf, ct } = await downloadAndValidate(url)
      const ext = extFromContentType(ct)
      const fileName = `${safe}.${ext}`
      const filePath = resolve(logosDir, fileName)
      writeFileSync(filePath, buf)
      const logoUrl = `/logos/${fileName}`
      await db.collection('logos').doc(safe).set({
        ticker: item.ticker,
        logoUrl,
        sourceUrl: url,
        contentType: ct,
        sizeBytes: buf.length,
        storedInRepo: true,
        updatedAt: new Date().toISOString(),
      })
      console.log(`[bulk-logos] ✓ ${item.ticker} → ${fileName} (${buf.length}B from ${url.slice(0, 60)})`)
      successes.push(item.ticker)
      saved = true
      break
    } catch (err) {
      // try next candidate
    }
  }
  if (!saved) {
    failures.push({ ticker: item.ticker, reason: `all ${candidates.length} candidates failed` })
    console.warn(`[bulk-logos] ✗ ${item.ticker}: all candidates failed`)
  }
}

// 5. Summary
console.log('')
console.log(`[bulk-logos] DONE.`)
console.log(`  Skipped existing: ${skipped.length}`)
console.log(`  Successfully fetched: ${successes.length}`)
console.log(`  Failed: ${failures.length}`)
if (failures.length > 0) {
  console.log('')
  console.log('[bulk-logos] Failed tickers (fix manually with update-logo.mjs):')
  for (const f of failures) console.log(`  - ${f.ticker}: ${f.reason}`)
}
console.log('')
console.log('[bulk-logos] Next steps:')
console.log('  git add public/logos/ && git commit -m "logos: backfill SPINE" && git push')
