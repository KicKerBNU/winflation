import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchMonthlyDy } from '../api/monthly-dy.api'
import type { MonthlyDyPick } from '../domain/monthly-dy.types'

export const useMonthlyDyStore = defineStore('monthly-dy', () => {
  const picks = ref<MonthlyDyPick[]>([])
  const generatedAt = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const hasData = computed(() => picks.value.length > 0)

  async function init() {
    if (picks.value.length > 0) return
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchMonthlyDy()
      if (!data) return
      generatedAt.value = data.generatedAt
      picks.value = data.picks
    } catch {
      error.value = 'Failed to load monthly DY picks.'
    } finally {
      isLoading.value = false
    }
  }

  return { picks, generatedAt, isLoading, error, hasData, init }
})
