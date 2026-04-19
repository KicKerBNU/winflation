import { GoogleGenAI } from '@google/genai'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { getCache, setCache } from '@/services/localCache'
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
  const cached = getCache<AiPhase1Response>(PHASE1_CACHE_KEY)
  if (cached) return cached

  const firestoreData = await fetchPhase1FromFirestore()
  if (firestoreData) {
    setCache(PHASE1_CACHE_KEY, firestoreData)
    return firestoreData
  }

  const prompt = `You are a financial analyst specializing in European dividend stocks. Select the top 10 EU-listed dividend stocks for long-term income investors, ranked by investment quality (yield sustainability, dividend growth track record, sector resilience, payout ratio health, and macroeconomic outlook).

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
- Only EU-listed companies (Euronext, Xetra, BME, Borsa Italiana, etc.)`

  const clean = await gemini(prompt)
  const data: AiPhase1Response = JSON.parse(clean)
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

  const prompt = `You are a financial analyst. For ${company} (${ticker}), provide the dividend history for the last 5 complete calendar years.

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
- Exactly 5 entries in each array, for the last 5 complete calendar years (oldest to newest)
- Use realistic historical data based on your knowledge`

  const clean = await gemini(prompt)
  const data: AiCompanyHistory = JSON.parse(clean)
  setCache(cacheKey, data)
  return data
}
