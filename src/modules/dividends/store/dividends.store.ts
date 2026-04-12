import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchDividendStocks } from '../api/dividends.api'
import type { DividendStock } from '../domain/dividends.types'

export const useDividendsStore = defineStore('dividends', () => {
  const stocks = ref<DividendStock[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const sortedByYield = computed(() => [...stocks.value].sort((a, b) => b.dividendYield - a.dividendYield))

  function beatsEcbRate(stock: DividendStock, depositRate: number): boolean {
    return stock.dividendYield > depositRate
  }

  async function init() {
    if (stocks.value.length) return
    isLoading.value = true
    error.value = null
    try {
      stocks.value = await fetchDividendStocks()
    } catch {
      error.value = 'Failed to load dividend data.'
    } finally {
      isLoading.value = false
    }
  }

  return { stocks, isLoading, error, sortedByYield, beatsEcbRate, init }
})
