import { MINERALS, MINERAL_COUNTRIES } from '../data/minerals.data'
import type { Mineral, MineralCountry } from '../domain/minerals.types'

export async function fetchMinerals(): Promise<Mineral[]> {
  return MINERALS
}

export async function fetchMineralCountries(): Promise<MineralCountry[]> {
  return MINERAL_COUNTRIES
}
