// One-time logo fetch for tickers in quarterly-dy-universe.mjs that don't yet
// have a file under public/logos/. Reuses the same pipeline as
// bulk-fetch-spine-logos.mjs (Yahoo domain → Gemini suggestion → Clearbit →
// Google favicon → DuckDuckGo favicon).
//
// Usage (from project root):
//   node --env-file=.env.local scripts/bulk-fetch-quarterly-dy-logos.mjs

import { QUARTERLY_DY_UNIVERSE } from './quarterly-dy-universe.mjs'
import { GoogleGenAI } from '@google/genai'
import YahooFinance from 'yahoo-finance2'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
const geminiKey =
  process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || ''

const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null

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
      const suggestedSeconds = err.message.match(/"retryDelay":"(\d+)s"/)?.[1]
      const delay = suggestedSeconds ? (+suggestedSeconds + 2) * 1000 : 2000 * 2 ** attempt
      console.log(`[gemini] rate-limited, retrying in ${Math.round(delay / 1000)}s…`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return ''
}

function existingLogoFile(safeT) {
  try {
    return readdirSync(logosDir).find((f) => f.toUpperCase().startsWith(`${safeT}.`)) ?? null
  } catch {
    return null
  }
}

async function fetchDomainFromYahoo(ticker) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile', 'price'] })
    const website = summary.summaryProfile?.website
    const name = summary.price?.longName ?? summary.price?.shortName ?? ticker
    if (!website) return { website: null, name }
    const clean = String(website).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/')[0]
    return { website: clean || null, name }
  } catch {
    return { website: null, name: ticker }
  }
}

async function fetchLogoSuggestions(items) {
  if (!ai) return []
  const list = items.map((c) => `- ${c.ticker} | ${c.name} | website: ${c.website || 'unknown'}`).join('\n')
  const prompt = `For each company below, return the single best public URL to its official logo.

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
  if (!ct.startsWith('image/')) throw new Error(`non-image content-type: ${ct}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) throw new Error(`invalid size: ${buf.length}`)
  return { buf, ct }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const allTickers = QUARTERLY_DY_UNIVERSE.map((e) => e.ticker)
console.log(`[quarterly-dy-logos] Universe: ${allTickers.length} tickers.`)

const needFetch = allTickers.filter((t) => !existingLogoFile(safeTicker(t)))
console.log(`[quarterly-dy-logos] Missing logos: ${needFetch.length}. Fetching now…\n`)

if (needFetch.length === 0) {
  console.log('[quarterly-dy-logos] All logos already present. Nothing to do.')
  process.exit(0)
}

// 1. Resolve domains via Yahoo
console.log('[quarterly-dy-logos] Resolving company websites via Yahoo…')
const domainResolved = await Promise.all(
  needFetch.map(async (ticker) => ({ ticker, ...(await fetchDomainFromYahoo(ticker)) })),
)

// 2. Gemini logo suggestions in chunks of 10
const geminiSuggestions = new Map()
if (ai) {
  const chunkSize = 10
  for (let i = 0; i < domainResolved.length; i += chunkSize) {
    const chunk = domainResolved.slice(i, i + chunkSize)
    console.log(`[quarterly-dy-logos] Gemini chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(domainResolved.length / chunkSize)} (${chunk.length} tickers)…`)
    const suggestions = await fetchLogoSuggestions(chunk)
    for (const s of suggestions) {
      if (s.ticker && s.logoUrl) geminiSuggestions.set(s.ticker.toUpperCase(), s.logoUrl)
    }
  }
} else {
  console.log('[quarterly-dy-logos] No GEMINI_API_KEY — skipping Gemini suggestions, using Clearbit/favicon only.')
}

// 3. Download best available logo for each ticker
const successes = []
const failures = []
for (const item of domainResolved) {
  const safe = safeTicker(item.ticker)
  const geminiUrl = geminiSuggestions.get(safe) ?? geminiSuggestions.get(item.ticker)
  const candidates = logoCandidates(geminiUrl, item.website)

  if (candidates.length === 0) {
    failures.push({ ticker: item.ticker, reason: 'no website, no Gemini suggestion' })
    console.warn(`[quarterly-dy-logos] ✗ ${item.ticker}: no candidates`)
    continue
  }

  let saved = false
  for (const url of candidates) {
    try {
      const { buf, ct } = await downloadAndValidate(url)
      const ext = extFromContentType(ct)
      const filePath = resolve(logosDir, `${safe}.${ext}`)
      writeFileSync(filePath, buf)
      console.log(`[quarterly-dy-logos] ✓ ${item.ticker} → ${safe}.${ext} (${buf.length}B)`)
      successes.push(item.ticker)
      saved = true
      break
    } catch {
      // try next candidate
    }
  }
  if (!saved) {
    failures.push({ ticker: item.ticker, reason: `all ${candidates.length} candidates failed` })
    console.warn(`[quarterly-dy-logos] ✗ ${item.ticker}: all candidates failed`)
  }
}

// 4. Refresh the frontend logo manifest
if (successes.length > 0) {
  console.log('\n[quarterly-dy-logos] Regenerating logo manifest…')
  spawnSync('node', [resolve(projectRoot, 'scripts', 'regenerate-logo-manifest.mjs')], { stdio: 'inherit' })
}

console.log(`\n[quarterly-dy-logos] Done. ✓ ${successes.length}  ✗ ${failures.length}`)
if (failures.length > 0) {
  console.log('\nFailed (fix manually with update-logo.mjs):')
  failures.forEach((f) => console.log(`  - ${f.ticker}: ${f.reason}`))
}
if (successes.length > 0) {
  console.log('\nNext: git add public/logos/ && git push (triggers Netlify rebuild)')
}
