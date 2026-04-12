export type RateType = 'deposit' | 'main' | 'marginal'

export interface EcbRate {
  type: RateType
  rate: number
  effectiveDate: string
}

export interface InterestRateState {
  rates: EcbRate[]
  isLoading: boolean
  error: string | null
}
