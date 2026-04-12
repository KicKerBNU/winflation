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

export interface CompanyDetail {
  ticker: string
  company: string
  country: string
  countryCode: string
  dividendYield: number
  annualDividend: number
  price: number
  priceChange: number
  priceChangePercent: number
  marketCap: number
  beta: number
  volume: number
  rangeHigh: number
  rangeLow: number
  sector: string
  industry: string
  exchange: string
  currency: string
  description: string
  ceo: string
  website: string
  image: string
}

export interface DividendsState {
  stocks: DividendStock[]
  isLoading: boolean
  error: string | null
}
