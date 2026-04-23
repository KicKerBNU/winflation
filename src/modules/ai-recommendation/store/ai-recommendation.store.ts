import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAiRecommendationsPhase1, fetchCompanyHistory } from '../api/ai-recommendation.api'
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
        historicYields: c.historicYields ?? null,
        dividendsPerYear: c.dividendsPerYear ?? null,
      }))
      isLoading.value = false

      await Promise.all(
        cards.value.map(async (card, idx) => {
          if (card.historicYields && card.dividendsPerYear) return
          try {
            const history = await fetchCompanyHistory(card.ticker, card.company, card.currency)
            if (history) {
              cards.value[idx] = { ...cards.value[idx], ...history }
            }
          } catch {
            // leave history as null — card already visible
          }
        }),
      )
    } catch {
      error.value = 'Failed to load AI recommendations.'
      isLoading.value = false
    }
  }

  return { cards, generatedAt, isLoading, error, hasData, init }
})
