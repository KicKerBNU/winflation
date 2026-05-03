// Weekly Quarterly DY pipeline — quarterly-paying dividend instruments.
//
// Flow:
//   1. Curated universe (quarterly-dy-universe.mjs) — ~50 tickers spanning
//      US Dividend Aristocrats/Achievers, Canadian banks & energy, and
//      select UK/European quarterly payers.
//   2. Yahoo Finance enriches each: quote (price, yield, calendarEvents,
//      summaryDetail, summaryProfile, defaultKeyStatistics) + chart() over a
//      5-year window (daily interval, events: dividends).
//   3. Drop tickers that didn't pay 3-5 dividends in the trailing 12 months.
//      Lower bound 3 accommodates Yahoo's chart() occasionally missing 1 event
//      near the period boundary. Upper bound 5 catches names with a special
//      dividend on top of 4 regular quarterly payments.
//   4. Risk tier is assigned deterministically from assetClass:
//        dividend-aristocrat / utility      → low
//        dividend-achiever / bank / energy / reit → medium
//   5. Payment date: Yahoo calendarEvents.dividendDate when available;
//      otherwise nextExDividendDate + 20 days (typical quarterly payer lag);
//      falls back to lastDistribution.date + 20 days when both are absent.
//   6. Persist to Firestore: quarterly-dy/latest + quarterly-dy/<YYYY-MM-DD>.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import YahooFinance from 'yahoo-finance2'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QUARTERLY_DY_UNIVERSE } from './quarterly-dy-universe.mjs'

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
      map.set(file.slice(0, dot).toUpperCase(), `/logos/${file}`)
    }
  } catch { /* logos dir absent — fine */ }
  return map
}
const LOGO_INDEX = buildLogoIndex()

const now = new Date()
const todayStr = now.toISOString().split('T')[0]
const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
const oneYearAgoIso = oneYearAgo.toISOString().slice(0, 10)

// ── Risk-tier assignment ──────────────────────────────────────────────────────
const RISK_BY_CLASS = {
  'dividend-aristocrat': 'low',
  'utility':             'low',
  'dividend-achiever':   'medium',
  'bank':                'medium',
  'energy':              'medium',
  'reit':                'medium',
}

// ── Country code lookup ───────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function toIsoDate(d) {
  if (!d) return null
  const t = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(t.getTime())) return null
  return t.toISOString().slice(0, 10)
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Yahoo Finance fetching ────────────────────────────────────────────────────
async function fetchYahooQuote(ticker) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ['price', 'summaryDetail', 'summaryProfile', 'defaultKeyStatistics', 'calendarEvents'],
    })
    const price  = summary.price
    const detail = summary.summaryDetail
    const profile = summary.summaryProfile
    const stats  = summary.defaultKeyStatistics
    const cal    = summary.calendarEvents
    if (!price?.regularMarketPrice) return null

    const annualDividend = detail?.dividendRate ?? detail?.trailingAnnualDividendRate ?? 0
    const yieldFraction  = detail?.dividendYield ?? detail?.trailingAnnualDividendYield ?? 0
    const exDate         = detail?.exDividendDate ? toIsoDate(detail.exDividendDate) : null
    const nextExDivDate  = cal?.exDividendDate ? toIsoDate(cal.exDividendDate) : null
    // dividendDate is the actual payment date — never fall back to exDividendDate
    const nextPaymentDate = cal?.dividendDate ? toIsoDate(cal.dividendDate) : null

    return {
      currentPrice:        +price.regularMarketPrice,
      currency:            price.currency ?? null,
      exchange:            price.exchangeName ?? null,
      marketCap:           +(price.marketCap ?? 0),
      priceChangePercent:  +((price.regularMarketChangePercent ?? 0) * 100).toFixed(4),
      annualDividend:      +annualDividend,
      dividendYield:       +(yieldFraction * 100).toFixed(2),
      sector:              profile?.sector ?? null,
      industry:            profile?.industry ?? null,
      country:             profile?.country ?? null,
      website:             profile?.website ?? null,
      shortName:           price.shortName ?? null,
      longName:            price.longName ?? null,
      lastExDividendDate:  exDate,
      nextExDividendDate:  nextExDivDate,
      nextPaymentDate,
      expenseRatio:        stats?.annualReportExpenseRatio != null ? +stats.annualReportExpenseRatio : null,
    }
  } catch (err) {
    console.warn(`[yahoo:quote] ${ticker}: ${err.message?.split('\n')[0] ?? err}`)
    return null
  }
}

async function fetchHistory(ticker) {
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: fiveYearsAgo,
      period2: now,
      interval: '1d',
      events: 'dividends',
    })

    const events  = result?.events ?? {}
    const divList = Array.isArray(events?.dividends)
      ? events.dividends
      : Object.values(events?.dividends ?? {})
    const distributions = divList
      .map((ev) => {
        const ts = typeof ev.date === 'number' ? ev.date * 1000 : new Date(ev.date).getTime()
        return { date: new Date(ts).toISOString().slice(0, 10), amount: +(ev.amount ?? 0).toFixed(4) }
      })
      .filter((d) => d.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Downsample daily candles to one entry per calendar month (last close of each month)
    const quotes  = Array.isArray(result?.quotes) ? result.quotes : []
    const monthly = new Map()
    for (const q of quotes) {
      const ts    = q.date instanceof Date ? q.date.getTime() : new Date(q.date).getTime()
      const close = q.close ?? q.adjclose ?? null
      if (!Number.isFinite(close) || close <= 0) continue
      const iso = new Date(ts).toISOString().slice(0, 10)
      const key = iso.slice(0, 7)
      const prev = monthly.get(key)
      if (!prev || iso > prev.date) monthly.set(key, { date: iso, close: +(+close).toFixed(4) })
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

function isQuarterly(distributions) {
  // 3-5 payments in trailing 12 months.
  // Lower bound 3: Yahoo occasionally misses 1 event near the period boundary.
  // Upper bound 5: catches quarterly names that also paid a special dividend.
  // Annual/semi-annual payers (1-2 payments) and monthly payers (9+) are rejected.
  const t12 = trailingTwelveMonths(distributions)
  return t12.length >= 3 && t12.length <= 5
}

// ── Main flow ─────────────────────────────────────────────────────────────────
console.log(`[${todayStr}] Quarterly DY pipeline starting. Universe size: ${QUARTERLY_DY_UNIVERSE.length}.`)

const enriched = await Promise.all(
  QUARTERLY_DY_UNIVERSE.map(async (entry) => {
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
console.log(`[enrich] Got quotes for ${present.length}/${QUARTERLY_DY_UNIVERSE.length}.`)

const quarterly = present.filter((c) => isQuarterly(c.distributions))
console.log(`[verify] ${quarterly.length}/${present.length} pay 3-5 distributions in trailing 12 months.`)
const dropped = present.filter((c) => !isQuarterly(c.distributions))
for (const d of dropped) {
  const t12 = trailingTwelveMonths(d.distributions).length
  console.log(`  - dropped ${d.entry.ticker}: ${t12} distributions in trailing 12mo (${d.distributions.length} in 5y)`)
}

if (quarterly.length === 0) {
  throw new Error('No tickers passed the quarterly-cadence verification. Not saving.')
}

// Sort by yield descending
const sorted = [...quarterly].sort((a, b) => b.quote.dividendYield - a.quote.dividendYield)

const picks = sorted.map((c, i) => {
  const lastDist    = c.distributions[c.distributions.length - 1] ?? null
  const t12         = trailingTwelveMonths(c.distributions)
  const trailingTotal = t12.reduce((s, d) => s + d.amount, 0)
  const annualDividend = c.quote.annualDividend > 0 ? c.quote.annualDividend : +trailingTotal.toFixed(4)
  const yieldFromPrice = c.quote.currentPrice > 0 && annualDividend > 0
    ? +((annualDividend / c.quote.currentPrice) * 100).toFixed(2)
    : 0
  const dividendYield = c.quote.dividendYield > 0 ? c.quote.dividendYield : yieldFromPrice

  // Payment date: Yahoo → estimate (nextExDiv + 20d) → lastDist + 20d → null
  // 20 days is the typical quarterly-payer lag (longer than monthly's 14d,
  // shorter than EU annual's 28d).
  const nextExDividendDate = c.quote.nextExDividendDate ?? null
  const nextPaymentDate = c.quote.nextPaymentDate
    ?? (nextExDividendDate ? addDays(nextExDividendDate, 20) : null)
    ?? (lastDist?.date ? addDays(lastDist.date, 20) : null)

  return {
    rank: i + 1,
    ticker: c.entry.ticker,
    company: c.quote.longName ?? c.quote.shortName ?? c.entry.ticker,
    country: c.quote.country ?? null,
    countryCode: countryNameToCode(c.quote.country),
    region: c.entry.region,
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
    nextExDividendDate,
    nextPaymentDate,
    recentDistributions: c.distributions,
    priceHistory: c.priceHistory,
  }
})

const riskDistribution = picks.reduce((acc, p) => {
  acc[p.riskTier] = (acc[p.riskTier] ?? 0) + 1
  return acc
}, {})

const payload = {
  generatedAt: new Date().toISOString(),
  universeSize: QUARTERLY_DY_UNIVERSE.length,
  qualifiedCount: picks.length,
  riskDistribution,
  picks,
}

await db.collection('quarterly-dy').doc('latest').set(payload)
await db.collection('quarterly-dy').doc(todayStr).set(payload)

console.log(
  `[${new Date().toISOString()}] Saved quarterly-dy/latest + quarterly-dy/${todayStr}. ${picks.length} picks. Risk: L=${riskDistribution.low ?? 0} M=${riskDistribution.medium ?? 0}.`,
)
console.log(`Top by yield: ${picks[0].company} @ ${picks[0].dividendYield}%`)
