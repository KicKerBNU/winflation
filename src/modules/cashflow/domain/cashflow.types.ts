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

export interface CashflowPriceCandle {
  date: string  // ISO YYYY-MM-DD (month-end close)
  close: number // in pick currency
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
  // History (up to trailing 5 years; will be shorter for younger tickers)
  recentDistributions: CashflowDistribution[]
  // Up to 60 monthly closes (trailing 5y); shorter when listing is younger
  priceHistory: CashflowPriceCandle[]
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
