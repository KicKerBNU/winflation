import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchMinerals, fetchMineralCountries } from '../api/minerals.api'
import type { Mineral, MineralCountry, MineralSymbol } from '../domain/minerals.types'

export const useMineralsStore = defineStore('minerals', () => {
  const minerals = ref<Mineral[]>([])
  const countries = ref<MineralCountry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const mineralBySymbol = computed(() => {
    const map = new Map<MineralSymbol, Mineral>()
    for (const m of minerals.value) map.set(m.symbol, m)
    return map
  })

  const countryByCode = computed(() => {
    const map = new Map<string, MineralCountry>()
    for (const c of countries.value) map.set(c.countryCode.toUpperCase(), c)
    return map
  })

  async function init() {
    if (minerals.value.length && countries.value.length) return
    isLoading.value = true
    error.value = null
    try {
      const [m, c] = await Promise.all([fetchMinerals(), fetchMineralCountries()])
      minerals.value = m
      countries.value = c
    } catch {
      error.value = 'Failed to load minerals data.'
    } finally {
      isLoading.value = false
    }
  }

  return { minerals, countries, isLoading, error, mineralBySymbol, countryByCode, init }
})
