import type { EcbRate, RateType } from '../domain/interest-rate.types'

const ECB_BASE = 'https://data-api.ecb.europa.eu/service/data/FM'

interface EcbJsonData {
  dataSets: Array<{
    series: Record<string, {
      observations: Record<string, number[]>
    }>
  }>
  structure: {
    dimensions: {
      observation: Array<{
        id: string
        values: Array<{ id: string }>
      }>
    }
  }
}

const SERIES: Record<RateType, string> = {
  deposit:  'B.U2.EUR.4F.KR.DFR.LEV',
  main:     'B.U2.EUR.4F.KR.MRR_FR.LEV',
  marginal: 'B.U2.EUR.4F.KR.MLFR.LEV',
}

async function fetchSeries(seriesKey: string): Promise<{ rate: number; date: string }> {
  const url = `${ECB_BASE}/${seriesKey}?format=jsondata&lastNObservations=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ECB API error: ${res.status}`)

  const data: EcbJsonData = await res.json()
  const series = Object.values(data.dataSets[0].series)[0]
  const obs = Object.values(series.observations)[0]
  const rate = obs[0]

  const timeDim = data.structure.dimensions.observation.find(d => d.id === 'TIME_PERIOD')!
  const date = timeDim.values[0].id

  return { rate, date }
}

export async function fetchEcbRates(): Promise<EcbRate[]> {
  const entries = Object.entries(SERIES) as [RateType, string][]

  const results = await Promise.all(
    entries.map(async ([type, key]) => {
      const { rate, date } = await fetchSeries(key)
      return { type, rate, effectiveDate: date } satisfies EcbRate
    }),
  )

  return results
}
