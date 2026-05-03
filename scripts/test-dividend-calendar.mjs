// Test script: verify Gemini dividend calendar enrichment for European picks.
//
// Usage (from project root):
//   node --env-file=.env.local scripts/test-dividend-calendar.mjs
//
// Optionally pass custom tickers as arguments:
//   node --env-file=.env.local scripts/test-dividend-calendar.mjs MUV2.DE ENEL.MI MC.PA

import { GoogleGenAI } from '@google/genai'

const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || ''
if (!geminiKey) throw new Error('Missing GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in environment.')

const ai = new GoogleGenAI({ apiKey: geminiKey })
const today = new Date().toISOString().split('T')[0]

// ── Default test tickers (well-known EU dividend payers) ─────────────────────
const DEFAULT_TICKERS = [
  { ticker: 'MUV2.DE', name: 'Munich Re' },
  { ticker: 'ENEL.MI', name: 'Enel' },
  { ticker: 'SAN.PA',  name: 'Sanofi' },
  { ticker: 'MC.PA',   name: 'LVMH' },
  { ticker: 'TEL.OL',  name: 'Telenor' },
]

// Allow overriding tickers from CLI args
const picks = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map((t) => ({ ticker: t, name: t }))
  : DEFAULT_TICKERS

// ── Helpers ───────────────────────────────────────────────────────────────────
function stripFences(text) {
  let t = text
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return t
}

async function callGeminiWithRetry(prompt) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt })
      return (res.text ?? '').trim()
    } catch (err) {
      const isRateLimit = err instanceof Error && err.message.includes('429')
      if (!isRateLimit || attempt === 4) throw err
      const suggestedSeconds = err.message.match(/"retryDelay":"(\d+)s"/)?.[1]
      const delay = suggestedSeconds ? (+suggestedSeconds + 2) * 1000 : 2000 * 2 ** attempt
      console.warn(`  [retry] 429 — waiting ${Math.round(delay / 1000)}s before attempt ${attempt + 2}…`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return ''
}

function isValidFutureDate(dateStr, minDaysOut = 0, maxDaysOut = 365) {
  if (!dateStr || typeof dateStr !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const daysOut = (new Date(`${dateStr}T00:00:00Z`) - Date.now()) / 86_400_000
  return daysOut >= minDaysOut && daysOut <= maxDaysOut
}

// ── Main test ─────────────────────────────────────────────────────────────────
console.log(`\n=== Dividend Calendar Test — ${today} ===`)
console.log(`Testing ${picks.length} tickers: ${picks.map((p) => p.ticker).join(', ')}\n`)

const list = picks.map((p) => `- ${p.ticker} (${p.name})`).join('\n')

const prompt = `Today is ${today}. For each European dividend stock below, provide the next announced dividend calendar:

1. "nextExDividendDate": the upcoming ex-dividend date (YYYY-MM-DD) — the last day to buy to be entitled to the dividend. Must be in the future.
2. "nextPaymentDate": the date shareholders actually receive the cash (YYYY-MM-DD). Must be strictly AFTER the ex-dividend date — never the same day.
3. "dividendAmount": the gross dividend amount per share in the stock's local currency.

Stocks:
${list}

Return ONLY raw JSON, no markdown, keyed by the exact ticker symbol shown:
{
  "TICKER.XX": { "nextExDividendDate": "YYYY-MM-DD", "nextPaymentDate": "YYYY-MM-DD", "dividendAmount": 0.00 },
  ...
}

Use null for any individual field you are not confident about. Do not guess dates — only provide what has been publicly announced.`

console.log('── Prompt sent to Gemini ──────────────────────────────────────────')
console.log(prompt)
console.log('───────────────────────────────────────────────────────────────────\n')

let raw
try {
  raw = stripFences(await callGeminiWithRetry(prompt))
} catch (err) {
  console.error(`✗ Gemini call failed: ${err.message.split('\n')[0]}`)
  process.exit(1)
}

console.log('── Raw Gemini response ────────────────────────────────────────────')
console.log(raw)
console.log('───────────────────────────────────────────────────────────────────\n')

let parsed
try {
  parsed = JSON.parse(raw)
} catch {
  console.error('✗ Response is not valid JSON — Gemini returned unexpected output.')
  process.exit(1)
}

console.log('── Validation results ─────────────────────────────────────────────')
let allOk = true
for (const { ticker } of picks) {
  const data = parsed[ticker]
  if (!data) {
    console.log(`  ${ticker}: ✗ missing from response`)
    allOk = false
    continue
  }

  const exDiv = isValidFutureDate(data.nextExDividendDate, 0, 365) ? data.nextExDividendDate : null
  const payment =
    isValidFutureDate(data.nextPaymentDate, 0, 395) && (exDiv ? data.nextPaymentDate > exDiv : true)
      ? data.nextPaymentDate
      : null
  const amount =
    typeof data.dividendAmount === 'number' && data.dividendAmount > 0
      ? data.dividendAmount
      : null

  const exDivStatus  = exDiv    ? `✓ ${exDiv}`                         : `✗ invalid (got: ${data.nextExDividendDate})`
  const paymentStatus = payment ? `✓ ${payment}`                       : `✗ invalid (got: ${data.nextPaymentDate})`
  const amountStatus  = amount  ? `✓ ${amount}`                        : `✗ invalid (got: ${data.dividendAmount})`

  console.log(`  ${ticker}:`)
  console.log(`    nextExDividendDate : ${exDivStatus}`)
  console.log(`    nextPaymentDate    : ${paymentStatus}`)
  console.log(`    dividendAmount     : ${amountStatus}`)

  if (!exDiv || !payment || !amount) allOk = false
}

console.log('───────────────────────────────────────────────────────────────────')
console.log(allOk ? '\n✓ All fields valid — feature is working.\n' : '\n⚠ Some fields missing or invalid — check output above.\n')
