import { GoogleGenAI } from '@google/genai'
import { getCache, setCache } from '@/services/localCache'
import type { CountryDebt, CountryEconomicAnalysis } from '../domain/inflation.types'

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const ISO_TO_EUROSTAT: Record<string, string> = { GR: 'EL' }

export async function fetchCountryDebt(isoCode: string): Promise<CountryDebt | null> {
  const geoCode = ISO_TO_EUROSTAT[isoCode.toUpperCase()] ?? isoCode.toUpperCase()
  const url = `${EUROSTAT_BASE}/gov_10dd_edpt1?format=JSON&freq=A&unit=PC_GDP&sector=S13&na_item=GD&geo=${geoCode}&lastTimePeriod=20`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  const timeCat = data.dimension?.['time']?.category
  if (!timeCat) return null

  const history = Object.entries(timeCat.index as Record<string, number>)
    .sort(([, a], [, b]) => a - b)
    .map(([year, idx]) => {
      const v = data.value?.[String(idx)]
      return v != null ? { year, debtPct: +Number(v).toFixed(1) } : null
    })
    .filter((p): p is { year: string; debtPct: number } => p !== null)

  if (!history.length) return null
  return { current: history[history.length - 1], history }
}

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  'en-US': 'English',
  'pt-BR': 'Brazilian Portuguese',
}

export async function fetchCountryEconomicAnalysis(
  isoCode: string,
  countryName: string,
  locale: string,
): Promise<CountryEconomicAnalysis | null> {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cacheKey = `country-economic:${isoCode}:${month}:${locale}`

  const cached = getCache<CountryEconomicAnalysis>(cacheKey)
  if (cached) return cached

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) return null

  const ai = new GoogleGenAI({ apiKey })

  const language = LOCALE_TO_LANGUAGE[locale] ?? 'English'
  const prompt = `You are a senior economic analyst. For ${countryName} (${isoCode}) in ${month}, provide a concise economic briefing focused strictly on economic matters.
Respond entirely in ${language}.

Return ONLY raw JSON — no markdown, no explanation:
{
  "generatedAt": "${month}",
  "priorities": [
    "<top economic priority 1>",
    "<top economic priority 2>",
    "<top economic priority 3>",
    "<top economic priority 4>",
    "<top economic priority 5>"
  ],
  "problems": [
    "<main economic problem 1>",
    "<main economic problem 2>",
    "<main economic problem 3>",
    "<main economic problem 4>",
    "<main economic problem 5>"
  ],
  "opportunities": [
    "<economic opportunity 1>",
    "<economic opportunity 2>",
    "<economic opportunity 3>",
    "<economic opportunity 4>",
    "<economic opportunity 5>"
  ]
}

Rules:
- Each entry must be one concise sentence (max 15 words)
- Focus only on economic aspects: fiscal policy, trade, industry, labor market, investment
- Base analysis on the most recent available data for this country`

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
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const data: CountryEconomicAnalysis = JSON.parse(clean)

  setCache(cacheKey, data)
  return data
}
