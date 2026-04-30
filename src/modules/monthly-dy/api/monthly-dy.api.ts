import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { getCache, setCache } from '@/services/localCache'
import type { MonthlyDyResponse } from '../domain/monthly-dy.types'

const CACHE_KEY = 'monthly-dy:latest'

async function fetchFromFirestore(): Promise<MonthlyDyResponse | null> {
  try {
    const snap = await getDoc(doc(db, 'monthly-dy', 'latest'))
    if (!snap.exists()) return null
    const data = snap.data() as MonthlyDyResponse
    // Reject if older than 14 days (weekly cron + buffer for outages)
    const generatedAt = new Date(data.generatedAt).getTime()
    if (Date.now() - generatedAt > 14 * 24 * 60 * 60 * 1000) return null
    return data
  } catch (err) {
    console.warn('[monthly-dy] Firestore read failed:', err)
    return null
  }
}

export async function fetchMonthlyDy(): Promise<MonthlyDyResponse | null> {
  const fresh = await fetchFromFirestore()
  if (fresh) {
    setCache(CACHE_KEY, fresh)
    return fresh
  }
  const cached = getCache<MonthlyDyResponse>(CACHE_KEY)
  if (cached) return cached
  return null
}
