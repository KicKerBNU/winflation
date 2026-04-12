import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchInflationData } from '../api/inflation.api'
import type { CountryInflation } from '../domain/inflation.types'

export const useInflationStore = defineStore('inflation', () => {
  const countries = ref<CountryInflation[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const sorted = computed(() => [...countries.value].sort((a, b) => b.rate - a.rate))

  const highestInflation = computed(() => sorted.value.slice(0, 5))

  function beatsInflation(countryCode: string, dividendYield: number): boolean {
    const entry = countries.value.find((c) => c.countryCode === countryCode)
    return entry ? dividendYield > entry.rate : false
  }

  async function init() {
    if (countries.value.length) return
    isLoading.value = true
    error.value = null
    try {
      countries.value = await fetchInflationData()
    } catch {
      error.value = 'Failed to load inflation data.'
    } finally {
      isLoading.value = false
    }
  }

  return { countries, isLoading, error, sorted, highestInflation, beatsInflation, init }
})
