import type { DividendStock, CompanyDetail } from '../domain/dividends.types'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

// Tickers to track — extend this list to add more EU dividend stocks
const TICKERS = [
  'ISP.MI', 'ENGI.PA', 'REP.MC', 'VOW3.DE', 'MBG.DE',
  'INGA.AS', 'ORA.PA', 'TEF.MC', 'ENI.MI', 'MAP.MC',
  'CS.PA', 'ENEL.MI', 'BAS.DE', 'ALV.DE', 'RAND.AS',
]

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', CY: 'Cyprus', CZ: 'Czech Republic',
  DE: 'Germany', DK: 'Denmark', EE: 'Estonia', ES: 'Spain', FI: 'Finland',
  FR: 'France', GR: 'Greece', HR: 'Croatia', HU: 'Hungary', IE: 'Ireland',
  IT: 'Italy', LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', MT: 'Malta',
  NL: 'Netherlands', PL: 'Poland', PT: 'Portugal', RO: 'Romania', SE: 'Sweden',
  SI: 'Slovenia', SK: 'Slovakia', GB: 'United Kingdom', CH: 'Switzerland',
  NO: 'Norway',
}

interface FmpProfile {
  symbol: string
  companyName: string
  currency: string
  exchangeFullName: string
  exchange: string
  sector: string
  industry: string
  country: string
  price: number
  lastDividend: number
  change: number
  changePercentage: number
  marketCap: number
  beta: number
  volume: number
  range: string
  description: string
  ceo: string
  website: string
  image: string
}

async function fetchProfile(ticker: string, apiKey: string): Promise<FmpProfile | null> {
  const res = await fetch(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${apiKey}`)
  if (!res.ok) return null
  const data: FmpProfile[] = await res.json()
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

export async function fetchCompanyDetail(ticker: string): Promise<CompanyDetail> {
  const apiKey = import.meta.env.VITE_FMP_API_KEY
  const res = await fetch(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${apiKey}`)
  if (!res.ok) throw new Error(`Failed to fetch profile for ${ticker}`)
  const data: FmpProfile[] = await res.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error(`No data found for ${ticker}`)
  const p = data[0]
  const parts = (p.range ?? '0-0').split('-').map(Number)
  const rangeLow = parts[0] ?? 0
  const rangeHigh = parts[1] ?? 0
  return {
    ticker: p.symbol,
    company: p.companyName,
    country: COUNTRY_NAMES[p.country] ?? p.country,
    countryCode: p.country,
    dividendYield: p.price > 0 && p.lastDividend > 0 ? +((p.lastDividend / p.price) * 100).toFixed(2) : 0,
    annualDividend: p.lastDividend,
    price: p.price,
    priceChange: p.change,
    priceChangePercent: p.changePercentage,
    marketCap: p.marketCap,
    beta: p.beta,
    volume: p.volume,
    rangeHigh,
    rangeLow,
    sector: p.sector,
    industry: p.industry,
    exchange: p.exchangeFullName,
    currency: p.currency,
    description: p.description,
    ceo: p.ceo,
    website: p.website,
    image: p.image,
  }
}

export async function fetchDividendStocks(): Promise<DividendStock[]> {
  const apiKey = import.meta.env.VITE_FMP_API_KEY

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('FMP API key is not configured. Add VITE_FMP_API_KEY to .env.local')
  }

  const profiles = await Promise.all(TICKERS.map((t) => fetchProfile(t, apiKey)))

  return profiles
    .filter((p): p is FmpProfile => p !== null && p.price > 0 && p.lastDividend > 0)
    .map((p) => ({
      ticker: p.symbol,
      company: p.companyName,
      country: COUNTRY_NAMES[p.country] ?? p.country,
      countryCode: p.country,
      dividendYield: +((p.lastDividend / p.price) * 100).toFixed(2),
      sector: p.sector,
      currency: p.currency,
      exchange: p.exchangeFullName,
    }))
    .sort((a, b) => b.dividendYield - a.dividendYield)
}
