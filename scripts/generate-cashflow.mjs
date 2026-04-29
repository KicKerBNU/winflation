// Weekly Cashflow pipeline — monthly-paying instruments accessible to EU
// retail investors.
//
// Flow:
//   1. Curated universe (cashflow-universe.mjs) — ~30 tickers, hand-picked.
//   2. Yahoo Finance enriches each: quote, summaryDetail, summaryProfile,
//      calendarEvents, defaultKeyStatistics, plus chart() over a 5-year window
//      (interval 1mo, events: dividends) to capture both 60 monthly closes for
//      the price-evolution chart and the full dividend stream for cadence
//      verification + the trailing-5y payments list.
//   3. Drop tickers that didn't pay 9-17 dividends in the trailing 12 months
//      (allow 1-2 missed months for plain-vanilla "monthly" stocks; upper
//      bound 17 covers monthly payers with quarterly supplementals like
//      MAIN). Quarterly payers still get rejected (4-5 events/year).
//   4. Risk tier is assigned deterministically from assetClass:
//        equity-reit / etf / stock         → low
//        bdc / energy-infra                → medium
//        mortgage-reit                     → high
//   5. Persist to Firestore: cashflow/latest + cashflow/<YYYY-MM-DD>.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import YahooFinance from 'yahoo-finance2'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CASHFLOW_UNIVERSE } from './cashflow-universe.mjs'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const firebaseJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!firebaseJsonRaw?.trim()) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT.')

let serviceAccount
try {
  serviceAccount = JSON.parse(firebaseJsonRaw)
} catch (err) {
  throw new Error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

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
  } catch { /* logos dir absent — fine */ }
  return map
}
const LOGO_INDEX = buildLogoIndex()

const today = new Date()
const todayStr = today.toISOString().split('T')[0]
const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
const fiveYearsAgo = new Date(today.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
const oneYearAgoIso = oneYearAgo.toISOString().slice(0, 10)

// ── Risk-tier assignment (deterministic from asset class) ─────────────────
const RISK_BY_CLASS = {
  'equity-reit':   'low',
  'etf':           'low',
  'stock':         'low',
  'bdc':           'medium',
  'energy-infra':  'medium',
  'mortgage-reit': 'high',
}

// ── Country code lookup ──────────────────────────────────────────────────
function countryNameToCode(name) {
  if (!name) return null
  const map = {
    'United States': 'US', 'USA': 'US', 'Canada': 'CA',
    'United Kingdom': 'GB', 'Switzerland': 'CH', 'Norway': 'NO',
    'Italy': 'IT', 'France': 'FR', 'Germany': 'DE', 'Spain': 'ES',
    'Netherlands': 'NL', 'Belgium': 'BE', 'Ireland': 'IE',
    'Finland': 'FI', 'Sweden': 'SE', 'Denmark': 'DK', 'Portugal': 'PT',
    'Austria': 'AT', 'Luxembourg': 'LU', 'Poland': 'PL', 'Greece': 'GR',
  }
  return map[name] ?? null
}

// ── Yahoo data fetching ──────────────────────────────────────────────────
async function fetchYahooQuote(ticker) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: [
        'price',
        'summaryDetail',
        'summaryProfile',
        'defaultKeyStatistics',
        'calendarEvents',
      ],
    })
    const price = summary.price
    const detail = summary.summaryDetail
    const profile = summary.summaryProfile
    const stats = summary.defaultKeyStatistics
    const cal = summary.calendarEvents
    if (!price?.regularMarketPrice) return null

    const annualDividend = detail?.dividendRate ?? detail?.trailingAnnualDividendRate ?? 0
    const yieldFraction = detail?.dividendYield ?? detail?.trailingAnnualDividendYield ?? 0

    const exDate = detail?.exDividendDate ? toIsoDate(detail.exDividendDate) : null
    const nextDivObj = cal?.dividendDate ?? cal?.exDividendDate ?? null
    const nextPaymentDate = nextDivObj ? toIsoDate(nextDivObj) : null

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
      lastExDividendDate: exDate,
      nextExDividendDate: cal?.exDividendDate ? toIsoDate(cal.exDividendDate) : null,
      nextPaymentDate,
      expenseRatio: stats?.annualReportExpenseRatio != null ? +stats.annualReportExpenseRatio : null,
    }
  } catch (err) {
    console.warn(`[yahoo:quote] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return null
  }
}

function toIsoDate(d) {
  if (!d) return null
  const t = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(t.getTime())) return null
  return t.toISOString().slice(0, 10)
}

async function fetchHistory(ticker) {
  // Yahoo chart() with a 5y window + DAILY interval. Daily is required because
  // interval=1mo silently drops some dividend events near the recent end of a
  // 5y window (observed for MAIN, GAIN). We then downsample the ~1260 daily
  // candles to one close per calendar month for the price-evolution chart.
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: fiveYearsAgo,
      period2: today,
      interval: '1d',
      events: 'dividends',
    })

    const events = result?.events ?? {}
    const divList = Array.isArray(events?.dividends)
      ? events.dividends
      : Object.values(events?.dividends ?? {})
    const distributions = divList
      .map((ev) => {
        const ts = typeof ev.date === 'number' ? ev.date * 1000 : new Date(ev.date).getTime()
        return {
          date: new Date(ts).toISOString().slice(0, 10),
          amount: +(ev.amount ?? 0).toFixed(4),
        }
      })
      .filter((d) => d.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Downsample daily candles to one entry per year-month, keeping the last
    // close of each month (most recent trading day in that month).
    const quotes = Array.isArray(result?.quotes) ? result.quotes : []
    const monthly = new Map() // 'YYYY-MM' -> { date, close }
    for (const q of quotes) {
      const ts = q.date instanceof Date ? q.date.getTime() : new Date(q.date).getTime()
      const close = q.close ?? q.adjclose ?? null
      if (!Number.isFinite(close) || close <= 0) continue
      const iso = new Date(ts).toISOString().slice(0, 10)
      const key = iso.slice(0, 7)
      const prev = monthly.get(key)
      if (!prev || iso > prev.date) {
        monthly.set(key, { date: iso, close: +(+close).toFixed(4) })
      }
    }
    const priceHistory = [...monthly.values()].sort((a, b) => a.date.localeCompare(b.date))

    return { distributions, priceHistory }
  } catch (err) {
    console.warn(`[yahoo:chart] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return { distributions: [], priceHistory: [] }
  }
}

function trailingTwelveMonths(distributions) {
  return distributions.filter((d) => d.date >= oneYearAgoIso)
}

function isMonthly(distributions) {
  // Allow 9-17 payments in trailing 12 months. Lower bound 9 because Yahoo's
  // chart() endpoint occasionally misses 1-3 dividend events near the period
  // boundary. Upper bound 17 captures monthly-cadence names that also pay
  // supplemental/enhanced dividends quarterly (e.g. MAIN: 12 monthlies + 4
  // supplementals = 16/year). Quarterly payers still get rejected (they top
  // out at 4-5).
  const t12 = trailingTwelveMonths(distributions)
  return t12.length >= 9 && t12.length <= 17
}

// ── Main flow ────────────────────────────────────────────────────────────
console.log(`[${todayStr}] Cashflow pipeline starting. Universe size: ${CASHFLOW_UNIVERSE.length}.`)

const enriched = await Promise.all(
  CASHFLOW_UNIVERSE.map(async (entry) => {
    const quote = await fetchYahooQuote(entry.ticker)
    if (!quote) {
      console.warn(`[enrich] ${entry.ticker}: no quote — dropping.`)
      return null
    }
    const { distributions, priceHistory } = await fetchHistory(entry.ticker)
    return { entry, quote, distributions, priceHistory }
  }),
)

const present = enriched.filter((c) => c !== null)
console.log(`[enrich] Got quotes for ${present.length}/${CASHFLOW_UNIVERSE.length}.`)

const monthly = present.filter((c) => isMonthly(c.distributions))
console.log(`[verify] ${monthly.length}/${present.length} pay 9-17 distributions in trailing 12 months.`)
const dropped = present.filter((c) => !isMonthly(c.distributions))
for (const d of dropped) {
  const t12 = trailingTwelveMonths(d.distributions).length
  console.log(`  - dropped ${d.entry.ticker}: ${t12} distributions in trailing 12mo (${d.distributions.length} in 5y)`)
}

if (monthly.length === 0) {
  throw new Error('No tickers passed the monthly-cadence verification. Not saving.')
}

// Sort by yield descending — that's the user's primary view
const sorted = [...monthly].sort((a, b) => b.quote.dividendYield - a.quote.dividendYield)

const picks = sorted.map((c, i) => {
  const lastDist = c.distributions[c.distributions.length - 1] ?? null
  const t12 = trailingTwelveMonths(c.distributions)
  const trailingTotal = t12.reduce((s, d) => s + d.amount, 0)
  // Prefer Yahoo's reported annualDividend; fall back to TTM sum if absent
  const annualDividend = c.quote.annualDividend > 0 ? c.quote.annualDividend : +trailingTotal.toFixed(4)
  // Recompute yield from price+annual when Yahoo's yield is 0 but the stock pays
  const yieldFromPrice = c.quote.currentPrice > 0 && annualDividend > 0
    ? +((annualDividend / c.quote.currentPrice) * 100).toFixed(2)
    : 0
  const dividendYield = c.quote.dividendYield > 0 ? c.quote.dividendYield : yieldFromPrice

  return {
    rank: i + 1,
    ticker: c.entry.ticker,
    company: c.quote.longName ?? c.quote.shortName ?? c.entry.ticker,
    country: c.quote.country ?? null,
    countryCode: countryNameToCode(c.quote.country),
    sector: c.quote.sector ?? null,
    industry: c.quote.industry ?? null,
    exchange: c.quote.exchange ?? null,
    currency: c.quote.currency ?? null,
    website: c.quote.website ?? null,
    logoUrl: LOGO_INDEX.get(safeTicker(c.entry.ticker)) ?? null,
    currentPrice: c.quote.currentPrice,
    marketCap: c.quote.marketCap,
    priceChangePercent: c.quote.priceChangePercent,
    annualDividend,
    dividendYield,
    paymentFrequency: t12.length,
    assetClass: c.entry.assetClass,
    riskTier: RISK_BY_CLASS[c.entry.assetClass] ?? 'medium',
    lastDividendDate: lastDist?.date ?? c.quote.lastExDividendDate ?? null,
    lastDividendAmount: lastDist?.amount ?? null,
    nextExDividendDate: c.quote.nextExDividendDate ?? null,
    nextPaymentDate: c.quote.nextPaymentDate ?? null,
    recentDistributions: c.distributions,
    priceHistory: c.priceHistory,
    expenseRatio: c.quote.expenseRatio ?? null,
  }
})

const riskDistribution = picks.reduce((acc, p) => {
  acc[p.riskTier] = (acc[p.riskTier] ?? 0) + 1
  return acc
}, {})

const payload = {
  generatedAt: new Date().toISOString(),
  universeSize: CASHFLOW_UNIVERSE.length,
  qualifiedCount: picks.length,
  riskDistribution,
  picks,
}

await db.collection('cashflow').doc('latest').set(payload)
await db.collection('cashflow').doc(todayStr).set(payload)

console.log(
  `[${new Date().toISOString()}] Saved cashflow/latest + cashflow/${todayStr}. ${picks.length} picks. Risk: L=${riskDistribution.low ?? 0} M=${riskDistribution.medium ?? 0} H=${riskDistribution.high ?? 0}.`,
)
console.log(`Top by yield: ${picks[0].company} @ ${picks[0].dividendYield}%`)
