import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAiRecommendationsPhase1 } from '../api/ai-recommendation.api'
import type { AiCompanyCard } from '../domain/ai-recommendation.types'

export const useAiRecommendationStore = defineStore('ai-recommendation', () => {
  const cards = ref<AiCompanyCard[]>([])
  const generatedAt = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const hasData = computed(() => cards.value.length > 0)

  async function init() {
    if (cards.value.length > 0) return
    isLoading.value = true
    error.value = null
    try {
      const phase1 = await fetchAiRecommendationsPhase1()
      if (!phase1) return
      generatedAt.value = phase1.generatedAt
      cards.value = phase1.companies.map((c) => ({
        ...c,
        historicYields: c.historicYields ?? [],
        dividendsPerYear: c.dividendsPerYear ?? [],
      }))
    } catch {
      error.value = 'Failed to load AI recommendations.'
    } finally {
      isLoading.value = false
    }
  }

  return { cards, generatedAt, isLoading, error, hasData, init }
})
