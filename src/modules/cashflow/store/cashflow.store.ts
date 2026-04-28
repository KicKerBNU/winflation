import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchCashflow } from '../api/cashflow.api'
import type { CashflowPick } from '../domain/cashflow.types'

export const useCashflowStore = defineStore('cashflow', () => {
  const picks = ref<CashflowPick[]>([])
  const generatedAt = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const hasData = computed(() => picks.value.length > 0)

  async function init() {
    if (picks.value.length > 0) return
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchCashflow()
      if (!data) return
      generatedAt.value = data.generatedAt
      picks.value = data.picks
    } catch {
      error.value = 'Failed to load cashflow picks.'
    } finally {
      isLoading.value = false
    }
  }

  return { picks, generatedAt, isLoading, error, hasData, init }
})
