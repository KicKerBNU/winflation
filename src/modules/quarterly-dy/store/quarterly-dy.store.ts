import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchQuarterlyDy } from '../api/quarterly-dy.api'
import type { QuarterlyDyPick } from '../domain/quarterly-dy.types'

export const useQuarterlyDyStore = defineStore('quarterly-dy', () => {
  const picks = ref<QuarterlyDyPick[]>([])
  const generatedAt = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const hasData = computed(() => picks.value.length > 0)

  async function init() {
    if (picks.value.length > 0) return
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchQuarterlyDy()
      if (!data) return
      generatedAt.value = data.generatedAt
      picks.value = data.picks
    } catch {
      error.value = 'Failed to load quarterly DY picks.'
    } finally {
      isLoading.value = false
    }
  }

  return { picks, generatedAt, isLoading, error, hasData, init }
})
