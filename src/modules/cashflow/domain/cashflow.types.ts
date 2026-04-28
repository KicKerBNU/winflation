export type AssetClass =
  | 'equity-reit'
  | 'mortgage-reit'
  | 'bdc'
  | 'energy-infra'
  | 'stock'
  | 'etf'

export type RiskTier = 'low' | 'medium' | 'high'

export interface CashflowDistribution {
  date: string   // ISO YYYY-MM-DD (ex-dividend date)
  amount: number // in pick currency
}

export interface CashflowPick {
  rank: number
  ticker: string
  company: string
  country: string | null
  countryCode: string | null
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
  annualDividend: number          // sum of trailing 12 months
  dividendYield: number           // 0-100
  paymentFrequency: number        // payments in trailing 12 months (10-13 for "monthly")
  // Risk
  assetClass: AssetClass
  riskTier: RiskTier
  // Calendar
  lastDividendDate: string | null    // last paid (ex-div date) ISO
  lastDividendAmount: number | null
  nextExDividendDate: string | null  // next scheduled ex-div (if known) ISO
  nextPaymentDate: string | null     // next scheduled payment date ISO
  // History (trailing 12 months)
  recentDistributions: CashflowDistribution[]
  // ETF-only fields
  expenseRatio?: number | null
}

export interface CashflowResponse {
  generatedAt: string
  universeSize: number
  qualifiedCount: number
  riskDistribution: Partial<Record<RiskTier, number>>
  picks: CashflowPick[]
}
