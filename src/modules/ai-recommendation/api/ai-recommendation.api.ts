import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { getCache, setCache } from '@/services/localCache'
import type { AiPhase1Response } from '../domain/ai-recommendation.types'

const PHASE1_CACHE_KEY = 'ai-recommendation:phase1:latest'

async function fetchPhase1FromFirestore(): Promise<AiPhase1Response | null> {
  try {
    const snap = await getDoc(doc(db, 'ai-recommendations', 'latest'))
    if (!snap.exists()) return null
    const data = snap.data() as AiPhase1Response
    // Reject if older than 36 hours (gives a 12h buffer past the daily 02:00 UTC run)
    const generatedAt = new Date(data.generatedAt).getTime()
    if (Date.now() - generatedAt > 36 * 60 * 60 * 1000) return null
    return data
  } catch (err) {
    console.warn('[AI Recommendations] Firestore read failed:', err)
    return null
  }
}

export async function fetchAiRecommendationsPhase1(): Promise<AiPhase1Response | null> {
  // 1. Firestore (primary — written daily by the GitHub Actions cron, includes
  //    real Yahoo Finance data and 5-year dividend history per company).
  const firestoreData = await fetchPhase1FromFirestore()
  if (firestoreData) {
    setCache(PHASE1_CACHE_KEY, firestoreData)
    return firestoreData
  }

  // 2. localStorage (fallback if Firestore is unreachable in this session).
  const cached = getCache<AiPhase1Response>(PHASE1_CACHE_KEY)
  if (cached) return cached

  // 3. No fallback to runtime Gemini — we no longer generate financial figures
  //    on the client. If Firestore is empty/stale and there's no local cache,
  //    the page will render the empty state until the cron heals.
  return null
}
