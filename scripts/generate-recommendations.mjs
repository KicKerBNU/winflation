// Daily AI Dividend Picks pipeline — quality-screened.
//
// Architecture:
//   1. Candidate pool = curated SPINE (~55 EU large-caps) + Gemini "watch list"
//      additions (~10 names not on the spine, in case our list is stale).
//   2. Yahoo Finance enriches each ticker with quote, dividend history, and
//      financialData (TTM payout ratio, ROE, debt, FCF, EBITDA). FMP is a
//      per-ticker fallback for the quote module only.
//   3. Compute quality metrics per ticker:
//        - payoutRatio (TTM, dividend / EPS)
//        - debtToEbitda (totalDebt / EBITDA — banks excluded, leverage doesn't apply)
//        - fcfCoverage (freeCashflow / annualDividendsPaid)
//        - roe (TTM)
//        - dividendStreak (consecutive years without > 30% cut, 5y window)
//        - dividendCagr5y (compound annual growth rate over the 5y window)
//        - revenueTtm (snapshot for context only)
//   4. Cascading hard filter — Conservative → Moderate → Permissive. Use the
//      strictest tier that yields ≥10 survivors. Banks/insurers/utilities/REITs
//      get sector-aware payout and debt thresholds.
//   5. Composite Quality Score (0–10), weighted:
//        - Sustainability 40% (payout + FCF coverage + debt/EBITDA)
//        - Growth 30%      (dividend streak + dividend CAGR)
//        - Profitability 20% (ROE)
//        - Yield 10%       (raw dividend yield, rewarding high yield AFTER quality)
//   6. Diversification caps — max 3 per sector, max 3 per country. Greedy by
//      score; skip if cap reached.
//   7. Narratives — feed each pick's metrics back to Gemini for tailored
//      pro/con/status, so the language reflects the actual numbers.
//   8. Persist /latest + /<YYYY-MM-DD>.
import { GoogleGenAI } from '@google/genai'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import YahooFinance from 'yahoo-finance2'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPINE } from './eu-dividend-universe.mjs'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const geminiKey =
  process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || ''
const firebaseJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT
const fmpKey =
  process.env.FMP_API_KEY?.trim() || process.env.VITE_FMP_API_KEY?.trim() || ''

if (!geminiKey) throw new Error('Missing GEMINI_API_KEY (or VITE_GEMINI_API_KEY).')
if (!firebaseJsonRaw?.trim()) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT.')

let serviceAccount
try {
  serviceAccount = JSON.parse(firebaseJsonRaw)
} catch (err) {
  throw new Error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const ai = new GoogleGenAI({ apiKey: geminiKey })

const FMP_BASE = 'https://financialmodelingprep.com/stable'

// Pre-loaded logo index from public/logos/ — built once at startup.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logosDir = resolve(projectRoot, 'public', 'logos')
function safeTicker(t) {
  return String(t).replace(/[^A-Za-z0-9._-]/g, '_').toUpperCase()
}
function buildLogoIndex() {
  const map = new Map()
  try {
    for (const file of readdirSync(logosDir)) {
      const dot = file.lastIndexOf('.')
      if (dot <= 0) continue
      const safe = file.slice(0, dot).toUpperCase()
      map.set(safe, `/logos/${file}`)
    }
  } catch {
    // public/logos/ doesn't exist yet — that's fine, no logos
  }
  return map
}
const LOGO_INDEX = buildLogoIndex()
console.log(`[startup] Loaded ${LOGO_INDEX.size} pre-stored logos from public/logos/`)

const now = new Date()
const today = now.toISOString().split('T')[0]
const currentYear = now.getUTCFullYear()
const lastCompleteYear = currentYear - 1
const firstYear = lastCompleteYear - 4
const targetYears = Array.from({ length: 5 }, (_, i) => firstYear + i)

// ── ECB rate ────────────────────────────────────────────────────────────────
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

// ── Gemini helpers ──────────────────────────────────────────────────────────
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

// ── Yahoo: quote + financialData + profile in one call ──────────────────────
async function fetchYahooQuote(ticker) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: [
        'price',
        'summaryDetail',
        'summaryProfile',
        'defaultKeyStatistics',
        'financialData',
      ],
    })
    const price = summary.price
    const detail = summary.summaryDetail
    const profile = summary.summaryProfile
    const fin = summary.financialData
    const stats = summary.defaultKeyStatistics
    if (!price?.regularMarketPrice) return null
    const annualDividend = detail?.dividendRate ?? detail?.trailingAnnualDividendRate ?? 0
    const yieldFraction = detail?.dividendYield ?? detail?.trailingAnnualDividendYield ?? 0
    return {
      currentPrice: +price.regularMarketPrice,
      currency: price.currency ?? null,
      exchange: price.exchangeName ?? null,
      marketCap: +(price.marketCap ?? 0),
      priceChangePercent: +((price.regularMarketChangePercent ?? 0) * 100).toFixed(4),
      annualDividend: +annualDividend,
      dividendYield: +(yieldFraction * 100).toFixed(2),
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
      country: profile?.country ?? null,
      website: profile?.website ?? null,
      shortName: price.shortName ?? null,
      longName: price.longName ?? null,
      // Quality inputs (TTM)
      payoutRatio: detail?.payoutRatio != null ? +detail.payoutRatio : null,
      roe: fin?.returnOnEquity != null ? +fin.returnOnEquity : null,
      totalDebt: fin?.totalDebt != null ? +fin.totalDebt : null,
      ebitda: fin?.ebitda != null ? +fin.ebitda : null,
      freeCashflow: fin?.freeCashflow != null ? +fin.freeCashflow : null,
      revenueTtm: fin?.totalRevenue != null ? +fin.totalRevenue : null,
      sharesOutstanding: stats?.sharesOutstanding != null ? +stats.sharesOutstanding : null,
      forwardPE: stats?.forwardPE != null ? +stats.forwardPE : null,
      beta: stats?.beta != null ? +stats.beta : null,
      source: 'yahoo',
    }
  } catch (err) {
    console.warn(`[yahoo:quote] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return null
  }
}

async function fetchYahooHistory(ticker) {
  try {
    const period1 = new Date(`${firstYear}-01-01T00:00:00Z`)
    const period2 = new Date(`${lastCompleteYear + 1}-01-01T00:00:00Z`)
    const result = await yahooFinance.chart(ticker, {
      period1, period2, interval: '1mo', events: 'dividends',
    })
    const divsByYear = new Map()
    const events = result?.events ?? {}
    const dividendList = Array.isArray(events?.dividends)
      ? events.dividends
      : Object.values(events?.dividends ?? {})
    for (const ev of dividendList) {
      const ts = typeof ev.date === 'number' ? ev.date * 1000 : new Date(ev.date).getTime()
      const dateStr = new Date(ts).toISOString().slice(0, 10)
      const year = new Date(ts).getUTCFullYear()
      if (year < firstYear || year > lastCompleteYear) continue
      const e = divsByYear.get(year) ?? { totalAmount: 0, payments: 0, payouts: [] }
      e.totalAmount += ev.amount ?? 0
      e.payments += 1
      e.payouts.push({ date: dateStr, amount: +(ev.amount ?? 0).toFixed(4) })
      divsByYear.set(year, e)
    }
    const yearEndClose = new Map()
    for (const bar of result?.quotes ?? []) {
      const year = new Date(bar.date).getUTCFullYear()
      if (bar.close != null) yearEndClose.set(year, bar.close)
    }
    const historicYields = targetYears.map((y) => {
      const div = divsByYear.get(y)?.totalAmount ?? 0
      const px = yearEndClose.get(y) ?? 0
      const yieldPct = px > 0 ? +((div / px) * 100).toFixed(2) : 0
      return { year: y, yield: yieldPct, dividend: +div.toFixed(3) }
    })
    const dividendsPerYear = targetYears.map((y) => {
      const e = divsByYear.get(y) ?? { totalAmount: 0, payments: 0, payouts: [] }
      const payouts = (e.payouts ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
      return {
        year: y,
        totalAmount: +e.totalAmount.toFixed(3),
        payments: e.payments,
        payouts,
      }
    })
    return { historicYields, dividendsPerYear }
  } catch (err) {
    console.warn(`[yahoo:history] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return null
  }
}

async function fetchFmpQuote(ticker) {
  if (!fmpKey) return null
  try {
    const res = await fetch(`${FMP_BASE}/profile?symbol=${encodeURIComponent(ticker)}&apikey=${fmpKey}`)
    if (!res.ok) return null
    const data = await res.json()
    const p = Array.isArray(data) ? data[0] : null
    if (!p?.price) return null
    return {
      currentPrice: +p.price,
      currency: p.currency ?? null,
      exchange: p.exchangeFullName ?? p.exchange ?? null,
      marketCap: +(p.marketCap ?? 0),
      priceChangePercent: +(p.changePercentage ?? 0),
      annualDividend: +(p.lastDividend ?? 0),
      dividendYield:
        p.price > 0 && p.lastDividend > 0
          ? +((p.lastDividend / p.price) * 100).toFixed(2)
          : 0,
      sector: p.sector ?? null,
      industry: p.industry ?? null,
      country: p.country ?? null,
      website: p.website ?? null,
      shortName: p.companyName ?? null,
      longName: p.companyName ?? null,
      // Quality inputs not available from FMP free tier — leave null
      payoutRatio: null, roe: null, totalDebt: null, ebitda: null,
      freeCashflow: null, revenueTtm: null, sharesOutstanding: null,
      forwardPE: null, beta: null,
      source: 'fmp',
    }
  } catch (err) {
    console.warn(`[fmp:quote] ${ticker}: ${err.message}`)
    return null
  }
}

// ── Quality metrics ─────────────────────────────────────────────────────────
function isFinancialSector(sector) {
  if (!sector) return false
  const s = sector.toLowerCase()
  return s.includes('financial') || s.includes('bank') || s.includes('insurance')
}
function isUtilityOrReit(sector) {
  if (!sector) return false
  const s = sector.toLowerCase()
  return s.includes('utilities') || s.includes('real estate') || s.includes('reit')
}

function computeMetrics(quote, history) {
  // dividend streak: count consecutive most-recent years where the dividend was
  // paid AND was not cut > 30% vs. the previous year. Walks backwards from the
  // last complete year and includes the starting year if it had a positive
  // dividend, so a 5-year stable payer scores 5 (not 4).
  const yearly = (history?.dividendsPerYear ?? []).map((d) => d.totalAmount)
  let streak = 0
  for (let i = yearly.length - 1; i >= 0; i--) {
    const cur = yearly[i]
    if (cur <= 0) break
    if (i === 0) { streak++; break }
    const prev = yearly[i - 1]
    if (prev <= 0) { streak++; break }  // bridge from a no-dividend year
    if (cur >= prev * 0.7) streak++
    else break  // dividend cut > 30% → streak ends
  }
  // 5y dividend CAGR — first non-zero to last non-zero
  let cagr = null
  const nonZero = yearly.map((v, i) => ({ v, i })).filter((x) => x.v > 0)
  if (nonZero.length >= 2) {
    const first = nonZero[0]
    const last = nonZero[nonZero.length - 1]
    const years = last.i - first.i
    if (years > 0) cagr = Math.pow(last.v / first.v, 1 / years) - 1
  }

  // FCF coverage: freeCashflow / (annualDividend * sharesOutstanding)
  let fcfCoverage = null
  if (
    quote.freeCashflow != null &&
    quote.annualDividend > 0 &&
    quote.sharesOutstanding != null &&
    quote.sharesOutstanding > 0
  ) {
    const dividendsPaidEstimate = quote.annualDividend * quote.sharesOutstanding
    if (dividendsPaidEstimate > 0) {
      fcfCoverage = quote.freeCashflow / dividendsPaidEstimate
    }
  }

  // debt/EBITDA — only meaningful for non-financials
  let debtToEbitda = null
  if (quote.totalDebt != null && quote.ebitda != null && quote.ebitda > 0) {
    debtToEbitda = quote.totalDebt / quote.ebitda
  }

  return {
    payoutRatio: quote.payoutRatio, // already 0-1
    roe: quote.roe, // already 0-1
    debtToEbitda,
    fcfCoverage,
    dividendStreak: streak,
    dividendCagr5y: cagr,
    revenueTtm: quote.revenueTtm,
  }
}

// ── Cascading hard filter ───────────────────────────────────────────────────
const TIERS = {
  conservative: {
    label: 'Conservative',
    minStreak: 5,
    maxPayout: 0.6,
    maxPayoutDefensive: 0.85, // utilities/REITs
    maxDebtEbitda: 2.5,
    minRoe: 0.12,
    minCagr: 0,
  },
  moderate: {
    label: 'Moderate',
    minStreak: 3,
    maxPayout: 0.75,
    maxPayoutDefensive: 0.95,
    maxDebtEbitda: 3.5,
    minRoe: 0.08,
    minCagr: -0.03,
  },
  permissive: {
    label: 'Permissive',
    // streak=0 lets through tickers whose Yahoo dividend history has gaps but
    // the current dividend is real (yield gate already enforces this). Payout
    // and ROE caps are loose because TTM payout > 100% is common for European
    // names in transition years and tells you little about future cuts.
    minStreak: 0,
    maxPayout: 1.5,
    maxPayoutDefensive: 1.75,
    maxDebtEbitda: 7,
    minRoe: -0.05,
    minCagr: -0.15,
  },
}

const TIER_ORDER = ['conservative', 'moderate', 'permissive']

// Strictest tier this candidate passes, or null if it fails even Permissive.
function qualifyingTier(quote, metrics) {
  for (const tier of TIER_ORDER) {
    if (passesTier(quote, metrics, tier)) return tier
  }
  return null
}

function passesTier(quote, m, tierKey) {
  const t = TIERS[tierKey]
  if (m.dividendStreak < t.minStreak) return false
  // Payout ratio: skip if null (data gap) only for permissive
  if (m.payoutRatio != null) {
    const cap = isUtilityOrReit(quote.sector) ? t.maxPayoutDefensive : t.maxPayout
    if (m.payoutRatio > cap) return false
  } else if (tierKey !== 'permissive') {
    return false
  }
  // ROE: skip null in permissive only
  if (m.roe != null) {
    if (m.roe < t.minRoe) return false
  } else if (tierKey !== 'permissive') {
    return false
  }
  // Debt/EBITDA: only for non-financials
  if (!isFinancialSector(quote.sector)) {
    if (m.debtToEbitda != null) {
      if (m.debtToEbitda > t.maxDebtEbitda) return false
    } else if (tierKey !== 'permissive') {
      return false
    }
  }
  // CAGR: prefer real growth; null treated as 0 for moderate+
  if (m.dividendCagr5y != null && m.dividendCagr5y < t.minCagr) return false
  return true
}

// Fill-to-target.
//
// Tier is now a per-pick LABEL (already attached to each candidate), not a
// gate. Selection narrows on yield-gate × diversification-caps and then takes
// the top N by composite quality score. Anything that fails even Permissive is
// already filtered out upstream, so every survivor here is a real dividend
// payer with sane fundamentals.
//
// Search order (strictest first, relax only if we can't fill):
//   1. caps:   3 → 4 → 5 → unlimited
//   2. yield:  2.0× → 1.5× → 1.0× → 0.5× → 0× ECB
function fillToTarget(candidates, ecbRate, target = 10) {
  const capLevels = [
    { sector: 3, country: 3 },
    { sector: 4, country: 4 },
    { sector: 5, country: 5 },
    { sector: 999, country: 999 },
  ]
  const yieldMults = [2.0, 1.5, 1.0, 0.5, 0]

  let best = { picked: [], yieldMult: 0, caps: capLevels[capLevels.length - 1] }

  for (const caps of capLevels) {
    for (const yMult of yieldMults) {
      const minY = ecbRate * yMult
      const aboveGate = candidates.filter(
        (c) => typeof c.quote.dividendYield === 'number' && c.quote.dividendYield > minY,
      )
      const scored = aboveGate.map((s) => ({ ...s, ...computeQualityScore(s.quote, s.metrics) }))
      const { picked } = applyDiversificationCaps(scored, {
        maxPerSector: caps.sector,
        maxPerCountry: caps.country,
        take: target,
      })
      if (picked.length > best.picked.length) {
        best = { picked, yieldMult: yMult, caps }
      }
      if (picked.length >= target) return best
    }
  }
  return best
}

// ── Composite Quality Score (0–10) ──────────────────────────────────────────
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}
function scoreSustainability(q, m) {
  // Lower payout, higher FCF cover, lower debt = better
  const payoutScore =
    m.payoutRatio == null
      ? 5
      : clamp(10 - m.payoutRatio * 12, 0, 10) // 0% → 10, 83% → 0
  const fcfScore =
    m.fcfCoverage == null
      ? 5
      : clamp(m.fcfCoverage * 4, 0, 10) // 2.5× cover → 10
  const debtScore = isFinancialSector(q.sector)
    ? 6
    : m.debtToEbitda == null
    ? 5
    : clamp(10 - m.debtToEbitda * 2, 0, 10) // 0× → 10, 5× → 0
  return (payoutScore + fcfScore + debtScore) / 3
}
function scoreGrowth(m) {
  const streakScore = clamp(m.dividendStreak * 2, 0, 10) // 5y streak → 10
  const cagrScore =
    m.dividendCagr5y == null
      ? 5
      : clamp(50 + m.dividendCagr5y * 200, 0, 10) // 0% → 5, 2.5% → 10, -2.5% → 0
  return (streakScore + cagrScore) / 2
}
function scoreProfitability(m) {
  if (m.roe == null) return 5
  return clamp(m.roe * 50, 0, 10) // 20% ROE → 10
}
function scoreYield(q) {
  return clamp(q.dividendYield * 0.8, 0, 10) // 12.5% → 10
}
function computeQualityScore(quote, metrics) {
  const sustainability = scoreSustainability(quote, metrics)
  const growth = scoreGrowth(metrics)
  const profit = scoreProfitability(metrics)
  const yieldScore = scoreYield(quote)
  const composite =
    sustainability * 0.4 + growth * 0.3 + profit * 0.2 + yieldScore * 0.1
  return {
    qualityScore: +composite.toFixed(1),
    breakdown: {
      sustainability: +sustainability.toFixed(1),
      growth: +growth.toFixed(1),
      profitability: +profit.toFixed(1),
      yield: +yieldScore.toFixed(1),
    },
  }
}

// ── Diversification caps ────────────────────────────────────────────────────
function applyDiversificationCaps(scored, { maxPerSector = 3, maxPerCountry = 3, take = 10 } = {}) {
  const sortedByScore = [...scored].sort((a, b) => b.qualityScore - a.qualityScore)
  const sectorCount = new Map()
  const countryCount = new Map()
  const picked = []
  const skipped = []
  for (const c of sortedByScore) {
    const sector = c.quote.sector || 'Unknown'
    const country = c.quote.country || 'Unknown'
    if ((sectorCount.get(sector) ?? 0) >= maxPerSector) {
      skipped.push({ ticker: c.ticker, reason: `sector cap (${sector})` })
      continue
    }
    if ((countryCount.get(country) ?? 0) >= maxPerCountry) {
      skipped.push({ ticker: c.ticker, reason: `country cap (${country})` })
      continue
    }
    picked.push(c)
    sectorCount.set(sector, (sectorCount.get(sector) ?? 0) + 1)
    countryCount.set(country, (countryCount.get(country) ?? 0) + 1)
    if (picked.length >= take) break
  }
  return { picked, skipped }
}

// ── Narrative generation (per pick, with metrics in context) ────────────────
async function generateNarrative(pick) {
  const m = pick.metrics
  const facts = [
    `Sector: ${pick.quote.sector ?? 'N/A'}`,
    `Country: ${pick.quote.country ?? 'N/A'}`,
    `Yield: ${pick.quote.dividendYield.toFixed(2)}%`,
    `Payout ratio: ${m.payoutRatio != null ? (m.payoutRatio * 100).toFixed(0) + '%' : 'unknown'}`,
    `ROE (TTM): ${m.roe != null ? (m.roe * 100).toFixed(0) + '%' : 'unknown'}`,
    `Debt/EBITDA: ${m.debtToEbitda != null ? m.debtToEbitda.toFixed(1) + 'x' : 'N/A (financial)'}`,
    `FCF coverage: ${m.fcfCoverage != null ? m.fcfCoverage.toFixed(1) + 'x' : 'unknown'}`,
    `Dividend streak: ${m.dividendStreak} years without > 30% cut`,
    `5y dividend CAGR: ${m.dividendCagr5y != null ? (m.dividendCagr5y * 100).toFixed(1) + '%' : 'unknown'}`,
    `Quality score: ${pick.qualityScore}/10`,
  ].join('\n')

  const prompt = `You are a financial analyst writing brief commentary on a European dividend stock.

Company: ${pick.quote.shortName ?? pick.ticker} (${pick.ticker})
${facts}

Write tight, one-sentence pro/con commentary in BOTH English and Brazilian Portuguese. Reflect the actual metrics above — do NOT use generic platitudes. If a metric is weak (high payout, weak ROE, high debt, short streak), say so.

Also assign a status: "bullish" (overall thesis is strong), "neutral" (mixed picture), or "bearish" (real concerns despite passing the screen).

Return ONLY raw JSON, no markdown:
{
  "status": "<bullish|neutral|bearish>",
  "pro": {
    "en-US": "<one sentence — main strength reflected in the numbers>",
    "pt-BR": "<same in Brazilian Portuguese>"
  },
  "con": {
    "en-US": "<one sentence — main risk or weakness reflected in the numbers>",
    "pt-BR": "<same in Brazilian Portuguese>"
  }
}`

  try {
    const raw = stripFences(await callGeminiWithRetry(prompt))
    const parsed = JSON.parse(raw)
    if (!parsed.pro || !parsed.con || !parsed.status) throw new Error('incomplete narrative')
    return parsed
  } catch (err) {
    console.warn(`[narrative] ${pick.ticker}: ${err.message} — using generic fallback`)
    return {
      status: 'neutral',
      pro: { 'en-US': 'Established dividend payer.', 'pt-BR': 'Pagadora de dividendos estabelecida.' },
      con: { 'en-US': 'Verify recent fundamentals before acting.', 'pt-BR': 'Verifique os fundamentos recentes antes de agir.' },
    }
  }
}

// ── Watch-list candidates from Gemini (beyond the spine) ────────────────────
async function fetchWatchList(spineTickers) {
  const prompt = `You are a financial analyst specializing in European dividend stocks.

Suggest 10 EU/European large-cap dividend-paying tickers NOT in this list:
${spineTickers.join(', ')}

Criteria:
- Listed on major European exchanges (Euronext, XETRA, Borsa Italiana, BME, Nasdaq Nordic, LSE, SIX Swiss).
- Established dividend record (paid for at least 3 years).
- Market cap > €5B.
- Yahoo Finance ticker format with country suffix (.MI .PA .DE .MC .AS .BR .L .SW .HE .OL .ST .CO).
- Diverse sectors and countries — avoid duplicating sectors already heavily represented above.

Return ONLY raw JSON, no markdown:
{ "watch": ["TICKER.SUFFIX", ...] }`

  try {
    const raw = stripFences(await callGeminiWithRetry(prompt))
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.watch) ? parsed.watch : []
  } catch (err) {
    console.warn(`[watch] Gemini failed: ${err.message}`)
    return []
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Main flow
// ════════════════════════════════════════════════════════════════════════════
const ecbDepositRate = await fetchEcbDepositRate()
const minYield = +(ecbDepositRate * 2).toFixed(2)
console.log(`[${today}] ECB deposit rate: ${ecbDepositRate}% → min yield: ${minYield}%`)

console.log(`[${new Date().toISOString()}] Asking Gemini for watch-list candidates beyond the spine…`)
const watchList = await fetchWatchList(SPINE)
console.log(`[${new Date().toISOString()}] Watch list (${watchList.length}): ${watchList.join(', ')}`)

const candidatePool = Array.from(new Set([...SPINE, ...watchList]))
console.log(`[${new Date().toISOString()}] Candidate pool: ${candidatePool.length} tickers`)

console.log(`[${new Date().toISOString()}] Enriching with Yahoo Finance (concurrency = 4)…`)
const enriched = await Promise.all(
  candidatePool.map(async (ticker) => {
    const quote = (await fetchYahooQuote(ticker)) ?? (await fetchFmpQuote(ticker))
    if (!quote) {
      console.warn(`[enrich] ${ticker}: no quote — dropping.`)
      return null
    }
    const history = await fetchYahooHistory(ticker)
    const metrics = computeMetrics(quote, history ?? { historicYields: [], dividendsPerYear: [] })
    return {
      ticker,
      quote,
      history: history ?? { historicYields: [], dividendsPerYear: [] },
      metrics,
    }
  }),
)
const present = enriched.filter((c) => c !== null)
console.log(`[${new Date().toISOString()}] Enriched ${present.length}/${candidatePool.length}.`)

// Tag every candidate with its strictest passing tier; drop the ones that fail
// even Permissive (negative ROE / payout > 150% / debt off-the-charts).
const labelled = present
  .map((c) => ({ ...c, qualifyingTier: qualifyingTier(c.quote, c.metrics) }))
  .filter((c) => c.qualifyingTier !== null)

const tierCounts = labelled.reduce((acc, c) => {
  acc[c.qualifyingTier] = (acc[c.qualifyingTier] ?? 0) + 1
  return acc
}, {})
console.log(
  `[tiers] Conservative=${tierCounts.conservative ?? 0} · Moderate=${tierCounts.moderate ?? 0} · Permissive=${tierCounts.permissive ?? 0} (dropped ${present.length - labelled.length} that failed even Permissive)`,
)

const TARGET = 10
const result = fillToTarget(labelled, ecbDepositRate, TARGET)
const { picked, yieldMult, caps } = result
const usedMinYield = +(ecbDepositRate * yieldMult).toFixed(2)

if (picked.length === 0) {
  throw new Error(
    `No candidates survived even the most permissive search (started with ${candidatePool.length} tickers, ${present.length} enriched, ${labelled.length} passed tier floor). Not saving.`,
  )
}

const pickedTierCounts = picked.reduce((acc, p) => {
  acc[p.qualifyingTier] = (acc[p.qualifyingTier] ?? 0) + 1
  return acc
}, {})
console.log(
  `[selection] yield-gate=${usedMinYield}% (${yieldMult}× ECB) · caps=${caps.sector}/sector,${caps.country}/country · picked=${picked.length}/${TARGET} · tiers in batch: C=${pickedTierCounts.conservative ?? 0} M=${pickedTierCounts.moderate ?? 0} P=${pickedTierCounts.permissive ?? 0}`,
)
if (picked.length < TARGET) {
  console.warn(
    `[selection] Could only fill ${picked.length} of ${TARGET} after relaxing every dimension. Consider expanding eu-dividend-universe.mjs.`,
  )
}
console.log(`[${new Date().toISOString()}] Generating narratives in parallel…`)

// Narratives (per pick, parallel)
const narratives = await Promise.all(picked.map((p) => generateNarrative(p)))

// Build the final company list
let logosMatched = 0
const companies = picked.map((p, i) => {
  const logoUrl = LOGO_INDEX.get(safeTicker(p.ticker)) ?? null
  if (logoUrl) logosMatched++
  return {
    rank: i + 1,
    ticker: p.ticker,
    company: p.quote.longName ?? p.quote.shortName ?? p.ticker,
    country: p.quote.country ?? null,
    countryCode: countryNameToCode(p.quote.country) ?? null,
    sector: p.quote.sector ?? null,
    industry: p.quote.industry ?? null,
    exchange: p.quote.exchange ?? null,
    currency: p.quote.currency ?? null,
    website: p.quote.website ?? null,
    logoUrl,
    currentPrice: p.quote.currentPrice,
    dividendYield: p.quote.dividendYield,
    annualDividend: p.quote.annualDividend,
    marketCap: p.quote.marketCap,
    priceChangePercent: p.quote.priceChangePercent,
    status: narratives[i].status,
    pro: narratives[i].pro,
    con: narratives[i].con,
    historicYields: p.history.historicYields,
    dividendsPerYear: p.history.dividendsPerYear,
    // Quality fields
    qualityScore: p.qualityScore,
    qualityBreakdown: p.breakdown,
    qualifyingTier: p.qualifyingTier,
    qualifyingTierLabel: TIERS[p.qualifyingTier].label,
    metrics: {
      payoutRatio: p.metrics.payoutRatio,
      roe: p.metrics.roe,
      debtToEbitda: p.metrics.debtToEbitda,
      fcfCoverage: p.metrics.fcfCoverage,
      dividendStreak: p.metrics.dividendStreak,
      dividendCagr5y: p.metrics.dividendCagr5y,
    },
  }
})
console.log(`[logos] Matched ${logosMatched}/${companies.length} picks to pre-stored logos in public/logos/`)

const payload = {
  generatedAt: new Date().toISOString(),
  ecbDepositRate,
  minYield: usedMinYield,
  yieldMultiplier: yieldMult,
  // Per-pick tier distribution (the legacy single batch-tier was dropped — each
  // pick now carries its own qualifyingTier so the UI can label them).
  tierDistribution: pickedTierCounts,
  poolSize: candidatePool.length,
  enrichedCount: present.length,
  tierFloorCount: labelled.length,
  qualifiedCount: picked.length,
  diversification: {
    maxPerSector: caps.sector === 999 ? null : caps.sector,
    maxPerCountry: caps.country === 999 ? null : caps.country,
    sectors: countBy(picked.map((p) => p.quote.sector || 'Unknown')),
    countries: countBy(picked.map((p) => p.quote.country || 'Unknown')),
  },
  companies,
}

await db.collection('ai-recommendations').doc('latest').set(payload)
await db.collection('ai-recommendations').doc(today).set(payload)

console.log(
  `[${new Date().toISOString()}] Saved /latest and /${today}. Top: ${companies[0]?.company} (${companies[0]?.qualifyingTierLabel}) @ ${companies[0]?.dividendYield}% yield (score ${companies[0]?.qualityScore}/10).`,
)

// ── Helpers ─────────────────────────────────────────────────────────────────
function countBy(arr) {
  const out = {}
  for (const v of arr) out[v] = (out[v] ?? 0) + 1
  return out
}

function countryNameToCode(name) {
  if (!name) return null
  const map = {
    Italy: 'IT', France: 'FR', Germany: 'DE', Spain: 'ES', Netherlands: 'NL',
    Belgium: 'BE', Switzerland: 'CH', 'United Kingdom': 'GB', Ireland: 'IE',
    Finland: 'FI', Norway: 'NO', Sweden: 'SE', Denmark: 'DK', Portugal: 'PT',
    Austria: 'AT', Luxembourg: 'LU', Poland: 'PL', Greece: 'GR',
  }
  return map[name] ?? null
}
