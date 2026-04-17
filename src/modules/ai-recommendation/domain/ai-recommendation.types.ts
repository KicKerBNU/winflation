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

export interface AiCompanyBase {
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
  status: CompanyStatus
  pro: string
  con: string
}

export interface AiCompanyCard extends AiCompanyBase {
  historicYields: YearlyYield[] | null
  dividendsPerYear: YearlyDividend[] | null
}

export interface AiCompanyHistory {
  historicYields: YearlyYield[]
  dividendsPerYear: YearlyDividend[]
}

export interface AiPhase1Response {
  generatedAt: string
  companies: AiCompanyBase[]
}

/** @deprecated use AiCompanyCard */
export type AiCompany = AiCompanyCard
