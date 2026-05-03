export type AssetClass =
  | 'dividend-aristocrat'
  | 'dividend-achiever'
  | 'utility'
  | 'bank'
  | 'energy'
  | 'reit'

export type RiskTier = 'low' | 'medium' | 'high'

export type Region = 'US' | 'CA' | 'UK' | 'EU'

export interface QuarterlyDyDistribution {
  date: string   // ISO YYYY-MM-DD (ex-dividend date)
  amount: number
}

export interface QuarterlyDyPriceCandle {
  date: string   // ISO YYYY-MM-DD (month-end close)
  close: number
}

export interface QuarterlyDyPick {
  rank: number
  ticker: string
  company: string
  country: string | null
  countryCode: string | null
  region: Region | null
  sector: string | null
  industry: string | null
  exchange: string | null
  currency: string | null
  website: string | null
  logoUrl: string | null
  // Pricing
  currentPrice: number
  marketCap: number
  priceChangePercent: number
  // Distribution
  annualDividend: number
  dividendYield: number           // 0-100
  paymentFrequency: number        // payments in trailing 12 months (3-5 for quarterly)
  // Risk
  assetClass: AssetClass
  riskTier: RiskTier
  // Calendar
  lastDividendDate: string | null
  lastDividendAmount: number | null
  nextExDividendDate: string | null
  nextPaymentDate: string | null
  // History
  recentDistributions: QuarterlyDyDistribution[]
  priceHistory: QuarterlyDyPriceCandle[]
}

export interface QuarterlyDyResponse {
  generatedAt: string
  universeSize: number
  qualifiedCount: number
  riskDistribution: Partial<Record<RiskTier, number>>
  picks: QuarterlyDyPick[]
}
