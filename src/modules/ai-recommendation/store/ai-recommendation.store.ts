import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchAiRecommendations } from '../api/ai-recommendation.api'
import type { AiRecommendationData } from '../domain/ai-recommendation.types'

export const useAiRecommendationStore = defineStore('ai-recommendation', () => {
  const data = ref<AiRecommendationData | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function init() {
    if (data.value) return
    isLoading.value = true
    error.value = null
    try {
      data.value = await fetchAiRecommendations()
    } catch {
      error.value = 'Failed to load AI recommendations.'
    } finally {
      isLoading.value = false
    }
  }

  return { data, isLoading, error, init }
})
