export type InflationTrend = 'up' | 'down' | 'stable'

export interface CountryInflation {
  country: string
  countryCode: string
  rate: number
  previousRate: number
  date: string
  trend: InflationTrend
}

export interface InflationState {
  countries: CountryInflation[]
  isLoading: boolean
  error: string | null
}

export interface InflationDataPoint {
  date: string
  rate: number
}

export interface CountryDebtPoint {
  year: string
  debtPct: number
}

export interface CountryDebt {
  current: CountryDebtPoint
  history: CountryDebtPoint[]
}

export interface CountryEconomicAnalysis {
  generatedAt: string
  priorities: string[]
  problems: string[]
  opportunities: string[]
}
