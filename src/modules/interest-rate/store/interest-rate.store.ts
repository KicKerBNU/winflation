import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchEcbRates } from '../api/interest-rate.api'
import type { EcbRate } from '../domain/interest-rate.types'

export const useInterestRateStore = defineStore('interest-rate', () => {
  const rates = ref<EcbRate[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const depositRate = computed(() => rates.value.find((r) => r.type === 'deposit'))
  const mainRate = computed(() => rates.value.find((r) => r.type === 'main'))
  const marginalRate = computed(() => rates.value.find((r) => r.type === 'marginal'))

  async function init() {
    if (rates.value.length) return
    isLoading.value = true
    error.value = null
    try {
      rates.value = await fetchEcbRates()
    } catch {
      error.value = 'Failed to load ECB rates.'
    } finally {
      isLoading.value = false
    }
  }

  return { rates, isLoading, error, depositRate, mainRate, marginalRate, init }
})
