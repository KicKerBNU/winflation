import type { DividendStock } from '../domain/dividends.types'

// TODO: replace with real financial data API (e.g. Financial Modeling Prep, Alpha Vantage)
const MOCK_STOCKS: DividendStock[] = [
  { ticker: 'ISP.MI', company: 'Intesa Sanpaolo', country: 'Italy', countryCode: 'IT', dividendYield: 9.8, sector: 'Banking', currency: 'EUR', exchange: 'Borsa Italiana' },
  { ticker: 'ENGI.PA', company: 'Engie SA', country: 'France', countryCode: 'FR', dividendYield: 9.0, sector: 'Utilities', currency: 'EUR', exchange: 'Euronext Paris' },
  { ticker: 'REP.MC', company: 'Repsol SA', country: 'Spain', countryCode: 'ES', dividendYield: 8.3, sector: 'Energy', currency: 'EUR', exchange: 'BME' },
  { ticker: 'VOW3.DE', company: 'Volkswagen AG', country: 'Germany', countryCode: 'DE', dividendYield: 8.5, sector: 'Automotive', currency: 'EUR', exchange: 'XETRA' },
  { ticker: 'MBG.DE', company: 'Mercedes-Benz Group', country: 'Germany', countryCode: 'DE', dividendYield: 8.2, sector: 'Automotive', currency: 'EUR', exchange: 'XETRA' },
  { ticker: 'INGA.AS', company: 'ING Groep NV', country: 'Netherlands', countryCode: 'NL', dividendYield: 7.8, sector: 'Banking', currency: 'EUR', exchange: 'Euronext Amsterdam' },
  { ticker: 'ORA.PA', company: 'Orange SA', country: 'France', countryCode: 'FR', dividendYield: 7.2, sector: 'Telecom', currency: 'EUR', exchange: 'Euronext Paris' },
  { ticker: 'TEF.MC', company: 'Telefonica SA', country: 'Spain', countryCode: 'ES', dividendYield: 6.9, sector: 'Telecom', currency: 'EUR', exchange: 'BME' },
  { ticker: 'ENI.MI', company: 'Eni SpA', country: 'Italy', countryCode: 'IT', dividendYield: 6.4, sector: 'Energy', currency: 'EUR', exchange: 'Borsa Italiana' },
  { ticker: 'MAP.MC', company: 'MAPFRE SA', country: 'Spain', countryCode: 'ES', dividendYield: 6.5, sector: 'Insurance', currency: 'EUR', exchange: 'BME' },
  { ticker: 'CS.PA', company: 'AXA SA', country: 'France', countryCode: 'FR', dividendYield: 6.8, sector: 'Insurance', currency: 'EUR', exchange: 'Euronext Paris' },
  { ticker: 'ENEL.MI', company: 'Enel SpA', country: 'Italy', countryCode: 'IT', dividendYield: 6.1, sector: 'Utilities', currency: 'EUR', exchange: 'Borsa Italiana' },
  { ticker: 'BAS.DE', company: 'BASF SE', country: 'Germany', countryCode: 'DE', dividendYield: 6.8, sector: 'Chemicals', currency: 'EUR', exchange: 'XETRA' },
  { ticker: 'ALV.DE', company: 'Allianz SE', country: 'Germany', countryCode: 'DE', dividendYield: 5.2, sector: 'Insurance', currency: 'EUR', exchange: 'XETRA' },
  { ticker: 'RAND.AS', company: 'Randstad NV', country: 'Netherlands', countryCode: 'NL', dividendYield: 5.9, sector: 'Professional Services', currency: 'EUR', exchange: 'Euronext Amsterdam' },
]

export async function fetchDividendStocks(): Promise<DividendStock[]> {
  // const { data } = await http.get<DividendStock[]>('/stocks/dividends')
  // return data
  return Promise.resolve(MOCK_STOCKS)
}
