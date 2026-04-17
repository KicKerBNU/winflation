import { GoogleGenAI } from '@google/genai'
import { getCache, setCache } from '@/services/localCache'
import type { AiRecommendationData } from '../domain/ai-recommendation.types'

const CACHE_KEY = 'ai-recommendation:latest'

export async function fetchAiRecommendations(): Promise<AiRecommendationData | null> {
  const cached = getCache<AiRecommendationData>(CACHE_KEY)
  if (cached) return cached

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not configured')

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `You are a financial analyst specializing in European dividend stocks. Based on your knowledge, select the top 10 EU-listed dividend stocks for long-term income investors, ranked by investment quality (yield sustainability, dividend growth track record, sector resilience, payout ratio health, and macroeconomic outlook).

Return ONLY a raw JSON object matching this exact structure — no markdown, no explanation:
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
      "historicYields": [
        { "year": <year>, "yield": <percentage>, "dividend": <per share amount> }
      ],
      "dividendsPerYear": [
        { "year": <year>, "totalAmount": <total annual dividend per share>, "payments": <number of payments that year> }
      ],
      "status": "<bullish|neutral|bearish>",
      "pro": "<one concise sentence — main investment strength>",
      "con": "<one concise sentence — main investment risk>"
    }
  ]
}

Rules:
- Exactly 10 companies, ranked 1–10
- historicYields: exactly 5 entries for the last 5 calendar years
- dividendsPerYear: exactly 5 entries for the last 5 calendar years
- Only include EU-listed companies (Euronext, Xetra, BME, Borsa Italiana, etc.)`

  let response
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
      })
      break
    } catch (err: unknown) {
      const isRateLimit = err instanceof Error && err.message.includes('429')
      if (!isRateLimit || attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
    }
  }

  const raw = response!.text ?? ''
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const data: AiRecommendationData = JSON.parse(clean)

  setCache(CACHE_KEY, data)
  return data
}
