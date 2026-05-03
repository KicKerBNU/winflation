import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { getCache, setCache } from '@/services/localCache'
import type { QuarterlyDyResponse } from '../domain/quarterly-dy.types'

const CACHE_KEY = 'quarterly-dy:latest'

async function fetchFromFirestore(): Promise<QuarterlyDyResponse | null> {
  try {
    const snap = await getDoc(doc(db, 'quarterly-dy', 'latest'))
    if (!snap.exists()) return null
    const data = snap.data() as QuarterlyDyResponse
    // Reject if older than 14 days (weekly cron + buffer for outages)
    const generatedAt = new Date(data.generatedAt).getTime()
    if (Date.now() - generatedAt > 14 * 24 * 60 * 60 * 1000) return null
    return data
  } catch (err) {
    console.warn('[quarterly-dy] Firestore read failed:', err)
    return null
  }
}

export async function fetchQuarterlyDy(): Promise<QuarterlyDyResponse | null> {
  const fresh = await fetchFromFirestore()
  if (fresh) {
    setCache(CACHE_KEY, fresh)
    return fresh
  }
  const cached = getCache<QuarterlyDyResponse>(CACHE_KEY)
  if (cached) return cached
  return null
}
