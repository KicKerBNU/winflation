export interface DividendStock {
  ticker: string
  company: string
  country: string
  countryCode: string
  dividendYield: number
  sector: string
  currency: string
  exchange: string
}

export interface DividendsState {
  stocks: DividendStock[]
  isLoading: boolean
  error: string | null
}
