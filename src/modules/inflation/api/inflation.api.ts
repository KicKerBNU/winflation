import type { CountryInflation, InflationDataPoint, InflationTrend } from '../domain/inflation.types'

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'

const EU27 = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'EL', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
])

// Eurostat uses EU codes which differ from ISO 3166-1 alpha-2 in one case
const EUROSTAT_TO_ISO: Record<string, string> = { EL: 'GR' }
const ISO_TO_EUROSTAT: Record<string, string> = { GR: 'EL' }

interface EurostatDataset {
  id: string[]
  size: number[]
  dimension: Record<string, {
    category: {
      index: Record<string, number>
      label: Record<string, string>
    }
  }>
  value: Record<string, number>
}

function stride(sizes: number[], dimPos: number): number {
  return sizes.slice(dimPos + 1).reduce((acc, s) => acc * s, 1)
}

export async function fetchInflationData(): Promise<CountryInflation[]> {
  const url = `${EUROSTAT_BASE}/prc_hicp_manr?format=JSON&freq=M&unit=RCH_A&coicop=CP00&lastTimePeriod=2`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Eurostat API error: ${res.status}`)

  const data: EurostatDataset = await res.json()

  const geoPos = data.id.indexOf('geo')
  const timePos = data.id.indexOf('time')
  const geoStride = stride(data.size, geoPos)
  const timeStride = stride(data.size, timePos)

  const geoCat = data.dimension['geo'].category
  const timeCat = data.dimension['time'].category

  const times = Object.entries(timeCat.index).sort(([, a], [, b]) => a - b)
  const latestTime = times[times.length - 1]
  const previousTime = times.length >= 2 ? times[times.length - 2] : null

  const result: CountryInflation[] = []

  for (const [code, geoIdx] of Object.entries(geoCat.index)) {
    if (!EU27.has(code)) continue

    const latestKey = String(geoIdx * geoStride + latestTime[1] * timeStride)
    const previousKey = previousTime ? String(geoIdx * geoStride + previousTime[1] * timeStride) : null

    const rate = data.value[latestKey]
    if (rate == null) continue

    const previousRate = previousKey != null ? data.value[previousKey] : undefined

    const trend: InflationTrend =
      previousRate == null ? 'stable'
      : rate > previousRate ? 'up'
      : rate < previousRate ? 'down'
      : 'stable'

    result.push({
      country: geoCat.label[code],
      countryCode: EUROSTAT_TO_ISO[code] ?? code,
      rate,
      previousRate: previousRate ?? rate,
      date: latestTime[0],
      trend,
    })
  }

  return result.sort((a, b) => a.country.localeCompare(b.country))
}

export async function fetchCountryHistory(isoCode: string, periods = 120): Promise<{ points: InflationDataPoint[]; countryName: string }> {
  const eurostatCode = ISO_TO_EUROSTAT[isoCode.toUpperCase()] ?? isoCode.toUpperCase()
  const url = `${EUROSTAT_BASE}/prc_hicp_manr?format=JSON&freq=M&unit=RCH_A&coicop=CP00&geo=${eurostatCode}&lastTimePeriod=${periods}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Eurostat API error: ${res.status}`)

  const data: EurostatDataset = await res.json()

  const timePos = data.id.indexOf('time')
  const timeStride = stride(data.size, timePos)

  const timeCat = data.dimension['time'].category
  const countryName = Object.values(data.dimension['geo'].category.label)[0] ?? isoCode.toUpperCase()

  const points: InflationDataPoint[] = Object.entries(timeCat.index)
    .sort(([, a], [, b]) => a - b)
    .map(([date, tIdx]) => {
      const rate = data.value[String(tIdx * timeStride)]
      return rate != null ? { date, rate } : null
    })
    .filter((p): p is InflationDataPoint => p !== null)

  return { points, countryName }
}
