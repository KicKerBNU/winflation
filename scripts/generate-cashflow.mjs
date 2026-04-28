// Weekly Cashflow pipeline — monthly-paying instruments accessible to EU
// retail investors.
//
// Flow:
//   1. Curated universe (cashflow-universe.mjs) — ~30 tickers, hand-picked.
//   2. Yahoo Finance enriches each: quote, summaryDetail, summaryProfile,
//      calendarEvents, defaultKeyStatistics, plus chart() for trailing 12mo
//      dividend events (used to verify monthly cadence + collect dates).
//   3. Drop tickers that didn't pay >= 10 dividends in the trailing 12 months
//      (allow 1-2 missed months for plain-vanilla "monthly" stocks; some
//      extend their ex-div schedule by a few weeks each year).
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

async function fetchTrailingDistributions(ticker) {
  // Yahoo chart() returns dividend events between period1 and period2.
  // We use it to (a) verify monthly cadence and (b) capture last 12 dates.
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: oneYearAgo,
      period2: today,
      interval: '1mo',
      events: 'dividends',
    })
    const events = result?.events ?? {}
    const list = Array.isArray(events?.dividends)
      ? events.dividends
      : Object.values(events?.dividends ?? {})
    const distributions = list
      .map((ev) => {
        const ts = typeof ev.date === 'number' ? ev.date * 1000 : new Date(ev.date).getTime()
        return {
          date: new Date(ts).toISOString().slice(0, 10),
          amount: +(ev.amount ?? 0).toFixed(4),
        }
      })
      .filter((d) => d.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
    return distributions
  } catch (err) {
    console.warn(`[yahoo:chart] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return []
  }
}

function isMonthly(distributions) {
  // Allow 9-14 payments in trailing 12 months. Lower bound 9 because Yahoo's
  // chart() endpoint occasionally misses 1-3 dividend events near the period
  // boundary; quarterly payers still get rejected (they top out at 4-5).
  return distributions.length >= 9 && distributions.length <= 14
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
    const distributions = await fetchTrailingDistributions(entry.ticker)
    return { entry, quote, distributions }
  }),
)

const present = enriched.filter((c) => c !== null)
console.log(`[enrich] Got quotes for ${present.length}/${CASHFLOW_UNIVERSE.length}.`)

const monthly = present.filter((c) => isMonthly(c.distributions))
console.log(`[verify] ${monthly.length}/${present.length} pay 10-14 distributions in trailing 12 months.`)
const dropped = present.filter((c) => !isMonthly(c.distributions))
for (const d of dropped) {
  console.log(`  - dropped ${d.entry.ticker}: ${d.distributions.length} distributions in trailing 12mo`)
}

if (monthly.length === 0) {
  throw new Error('No tickers passed the monthly-cadence verification. Not saving.')
}

// Sort by yield descending — that's the user's primary view
const sorted = [...monthly].sort((a, b) => b.quote.dividendYield - a.quote.dividendYield)

const picks = sorted.map((c, i) => {
  const lastDist = c.distributions[c.distributions.length - 1] ?? null
  const trailingTotal = c.distributions.reduce((s, d) => s + d.amount, 0)
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
    paymentFrequency: c.distributions.length,
    assetClass: c.entry.assetClass,
    riskTier: RISK_BY_CLASS[c.entry.assetClass] ?? 'medium',
    lastDividendDate: lastDist?.date ?? c.quote.lastExDividendDate ?? null,
    lastDividendAmount: lastDist?.amount ?? null,
    nextExDividendDate: c.quote.nextExDividendDate ?? null,
    nextPaymentDate: c.quote.nextPaymentDate ?? null,
    recentDistributions: c.distributions,
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
