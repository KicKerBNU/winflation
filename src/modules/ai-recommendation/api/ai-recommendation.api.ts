import { GoogleGenAI } from '@google/genai'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { getCache, setCache } from '@/services/localCache'
import { fetchEcbRates } from '@/modules/interest-rate/api/interest-rate.api'
import type { AiPhase1Response, AiCompanyHistory } from '../domain/ai-recommendation.types'

const PHASE1_CACHE_KEY = 'ai-recommendation:phase1:latest'

async function fetchPhase1FromFirestore(): Promise<AiPhase1Response | null> {
  try {
    const snap = await getDoc(doc(db, 'ai-recommendations', 'latest'))
    if (!snap.exists()) return null
    const data = snap.data() as AiPhase1Response
    // Reject if older than 36 hours (gives a 4h buffer past the daily 08:00 UTC run)
    const generatedAt = new Date(data.generatedAt).getTime()
    if (Date.now() - generatedAt > 36 * 60 * 60 * 1000) return null
    return data
  } catch (err) {
    console.warn('[AI Recommendations] Firestore read failed, falling back to Gemini:', err)
    return null
  }
}

async function gemini(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not configured')
  const ai = new GoogleGenAI({ apiKey })
  let response
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await ai.models.generateContent({ model: 'gemini-flash-latest', contents: prompt })
      break
    } catch (err: unknown) {
      const isRateLimit = err instanceof Error && err.message.includes('429')
      if (!isRateLimit || attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
    }
  }
  const raw = response!.text ?? ''
  return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
}

export async function fetchAiRecommendationsPhase1(): Promise<AiPhase1Response | null> {
  // 1. Firestore (primary — written daily by the GitHub Actions cron)
  const firestoreData = await fetchPhase1FromFirestore()
  if (firestoreData) {
    setCache(PHASE1_CACHE_KEY, firestoreData)
    return firestoreData
  }

  // 2. localStorage (fallback if Firestore is unreachable or stale)
  const cached = getCache<AiPhase1Response>(PHASE1_CACHE_KEY)
  if (cached) return cached

  // 3. Real-time Gemini (worst case — slow prompt, ~30s)

  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getUTCFullYear()
  const lastCompleteYear = currentYear - 1

  const ecbRates = await fetchEcbRates()
  const ecbDepositRate = ecbRates.find((r) => r.type === 'deposit')?.rate ?? 2
  const minYield = +(ecbDepositRate * 2).toFixed(2)

  const prompt = `You are a financial analyst specializing in European dividend stocks.

CURRENT DATE: ${today}
CURRENT YEAR: ${currentYear}

Select the top 10 EU-listed dividend stocks for long-term income investors as of ${today}, ranked by investment quality (yield sustainability, dividend growth track record, sector resilience, payout ratio health, and macroeconomic outlook).

YIELD THRESHOLD (HARD REQUIREMENT — ABSOLUTE):
- The ECB deposit facility rate is currently ${ecbDepositRate}%.
- Every company's current dividendYield MUST be STRICTLY GREATER THAN ${minYield}% (which is 2× the ECB deposit rate).
- Do NOT include any company with dividendYield ≤ ${minYield}%. If a candidate does not clearly exceed ${minYield}%, exclude it and pick a different one.

Return ONLY a raw JSON object — no markdown, no explanation:
{
  "generatedAt": "<today's ISO date>",
  "companies": [
    {
      "rank": <1-10>,
      "ticker": "<exchange:ticker, e.g. EPA:AIR>",
      "company": "<full company name>",
      "country": "<country name>",
      "countryCode": "<2-letter ISO country code>",
      "sector": "<sector>",
      "exchange": "<exchange full name>",
      "currency": "<3-letter currency code>",
      "website": "<company root domain, e.g. airbus.com>",
      "currentPrice": <number>,
      "dividendYield": <current yield as percentage, e.g. 5.2>,
      "annualDividend": <annual dividend per share>,
      "marketCap": <market cap in full units>,
      "priceChangePercent": <estimated recent 1-day change %>,
      "status": "<bullish|neutral|bearish>",
      "pro": {
        "en-US": "<one concise sentence in English — main investment strength>",
        "pt-BR": "<same sentence in Brazilian Portuguese>",
        "fr-FR": "<same sentence in French>",
        "it-IT": "<same sentence in Italian>",
        "es-ES": "<same sentence in Spanish>"
      },
      "con": {
        "en-US": "<one concise sentence in English — main investment risk>",
        "pt-BR": "<same sentence in Brazilian Portuguese>",
        "fr-FR": "<same sentence in French>",
        "it-IT": "<same sentence in Italian>",
        "es-ES": "<same sentence in Spanish>"
      }
    }
  ]
}

Rules:
- Exactly 10 companies, ranked 1–10
- Only EU-listed companies (Euronext, Xetra, BME, Borsa Italiana, etc.)
- currentPrice, dividendYield, annualDividend, marketCap, priceChangePercent MUST reflect the most recent values available as of ${today}. Prefer ${currentYear} data; fall back to late-${lastCompleteYear} if ${currentYear} is unavailable. Do NOT use values from years earlier than ${lastCompleteYear}.
- The "status" field reflects the investment outlook as of ${today}.`

  const clean = await gemini(prompt)
  const data: AiPhase1Response = JSON.parse(clean)

  const before = data.companies.length
  data.companies = data.companies
    .filter((c) => typeof c.dividendYield === 'number' && c.dividendYield > minYield)
    .sort((a, b) => b.dividendYield - a.dividendYield)
    .map((c, i) => ({ ...c, rank: i + 1 }))
  if (data.companies.length === 0) {
    throw new Error(`AI returned ${before} companies, none above ${minYield}% yield threshold.`)
  }
  if (data.companies.length < before) {
    console.warn(
      `[AI Recommendations] Dropped ${before - data.companies.length}/${before} companies below ${minYield}% yield.`,
    )
  }

  setCache(PHASE1_CACHE_KEY, data)
  return data
}

export async function fetchCompanyHistory(
  ticker: string,
  company: string,
  currency: string,
): Promise<AiCompanyHistory | null> {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cacheKey = `ai-recommendation:history:${ticker}:${month}`

  const cached = getCache<AiCompanyHistory>(cacheKey)
  if (cached) return cached

  const today = now.toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear()
  const lastCompleteYear = currentYear - 1
  const firstYear = lastCompleteYear - 4
  const targetYears = Array.from({ length: 5 }, (_, i) => firstYear + i)
  const excludedYearCeiling = firstYear - 1

  const prompt = `You are a financial analyst.

CURRENT DATE: ${today}
CURRENT YEAR: ${currentYear}
LAST COMPLETE CALENDAR YEAR: ${lastCompleteYear}

For ${company} (${ticker}), provide the dividend history for exactly these 5 years (oldest to newest): ${targetYears.join(', ')}.

Return ONLY raw JSON — no markdown, no explanation:
{
  "historicYields": [
    { "year": <year>, "yield": <annual dividend yield as percentage>, "dividend": <annual dividend per share in ${currency}> }
  ],
  "dividendsPerYear": [
    { "year": <year>, "totalAmount": <total annual dividend per share in ${currency}>, "payments": <number of dividend payments that year> }
  ]
}

Rules:
- historicYields MUST contain exactly 5 entries, one for each of: ${targetYears.join(', ')}. Most recent entry = ${lastCompleteYear}.
- dividendsPerYear MUST contain exactly 5 entries for the same years: ${targetYears.join(', ')}. Most recent entry = ${lastCompleteYear}.
- Do NOT output any entry with year ≤ ${excludedYearCeiling}. Do NOT output an entry for ${currentYear} (year not yet complete).
- Use realistic historical data based on your knowledge.`

  const clean = await gemini(prompt)
  const data: AiCompanyHistory = JSON.parse(clean)
  setCache(cacheKey, data)
  return data
}
