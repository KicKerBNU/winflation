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
export type QualityTier = 'conservative' | 'moderate' | 'permissive'

export type LocalizedText = {
  'en-US': string
  'pt-BR': string
}

export interface QualityBreakdown {
  sustainability: number
  growth: number
  profitability: number
  yield: number
}

export interface CompanyMetrics {
  payoutRatio: number | null
  roe: number | null
  debtToEbitda: number | null
  fcfCoverage: number | null
  dividendStreak: number
  dividendCagr5y: number | null
}

export interface AiCompanyBase {
  rank: number
  ticker: string
  company: string
  country: string
  countryCode: string
  sector: string
  industry?: string
  exchange: string
  currency: string
  website: string
  currentPrice: number
  dividendYield: number
  annualDividend: number
  marketCap: number
  priceChangePercent: number
  status: CompanyStatus
  pro: LocalizedText
  con: LocalizedText
  logoUrl?: string
  qualityScore?: number
  qualityBreakdown?: QualityBreakdown
  metrics?: CompanyMetrics
}

export interface AiCompanyCard extends AiCompanyBase {
  historicYields: YearlyYield[] | null
  dividendsPerYear: YearlyDividend[] | null
}

export interface AiPhase1Company extends AiCompanyBase {
  historicYields?: YearlyYield[]
  dividendsPerYear?: YearlyDividend[]
}

export interface DiversificationSummary {
  maxPerSector: number
  maxPerCountry: number
  sectors: Record<string, number>
  countries: Record<string, number>
}

export interface AiPhase1Response {
  generatedAt: string
  ecbDepositRate?: number
  minYield?: number
  yieldMultiplier?: number
  qualityTier?: QualityTier
  qualityTierLabel?: string
  poolSize?: number
  enrichedCount?: number
  qualifiedCount?: number
  diversification?: DiversificationSummary
  companies: AiPhase1Company[]
}

/** @deprecated use AiCompanyCard */
export type AiCompany = AiCompanyCard
