export interface YearlyYield {
  year: number
  yield: number
  dividend: number
}

export interface YearlyDividend {
  year: number
  totalAmount: number
  payments: number
}

export type CompanyStatus = 'bullish' | 'neutral' | 'bearish'

export interface AiCompany {
  rank: number
  ticker: string
  company: string
  country: string
  countryCode: string
  sector: string
  exchange: string
  currency: string
  website: string
  currentPrice: number
  dividendYield: number
  annualDividend: number
  marketCap: number
  priceChangePercent: number
  historicYields: YearlyYield[]
  dividendsPerYear: YearlyDividend[]
  status: CompanyStatus
  pro: string
  con: string
}

export interface AiRecommendationData {
  generatedAt: string
  companies: AiCompany[]
}
