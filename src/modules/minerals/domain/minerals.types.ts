export type MineralSymbol =
  | 'Nd'
  | 'Pr'
  | 'Dy'
  | 'Tb'
  | 'Li'
  | 'Co'
  | 'Graphite'
  | 'La'
  | 'Ce'
  | 'Monazite'

export type MineralCategory = 'magnet' | 'battery' | 'other'

export interface Mineral {
  symbol: MineralSymbol
  nameKey: string
  descriptionKey: string
  useKey: string
  category: MineralCategory
}

export type CompanyStage = 'producer' | 'developer' | 'exploration'
export type Profitability = 'profitable' | 'transitioning' | 'not-yet'
export type DividendStatus = 'none' | 'paying' | 'variable'
export type RiskLevel = 'low' | 'moderate' | 'high'

export interface CompanyFinancials {
  stage: CompanyStage
  ticker?: string
  profitability: Profitability
  netIncome?: string
  revenueGrowthYoY?: string
  dividend: DividendStatus
  mineLife?: string
  riskLevel: RiskLevel
  catalystKey?: string
  contractsKey?: string
}

export interface MineralCompany {
  name: string
  descriptionKey: string
  website?: string
  financials?: CompanyFinancials
}

export interface MineralCountry {
  countryCode: string
  nameKey: string
  lat: number
  lng: number
  statusKey: string
  minerals: MineralSymbol[]
  companies: MineralCompany[]
}
