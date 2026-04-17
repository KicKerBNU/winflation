import { GoogleGenAI } from '@google/genai'
import { getCache, setCache } from '@/services/localCache'
import type { AiPhase1Response, AiCompanyHistory } from '../domain/ai-recommendation.types'

const PHASE1_CACHE_KEY = 'ai-recommendation:phase1:latest'

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
      "pro": "<one concise sentence — main investment strength>",
      "con": "<one concise sentence — main investment risk>"
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
