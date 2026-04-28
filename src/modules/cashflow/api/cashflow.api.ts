import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { getCache, setCache } from '@/services/localCache'
import type { CashflowResponse } from '../domain/cashflow.types'

const CACHE_KEY = 'cashflow:latest'

async function fetchFromFirestore(): Promise<CashflowResponse | null> {
  try {
    const snap = await getDoc(doc(db, 'cashflow', 'latest'))
    if (!snap.exists()) return null
    const data = snap.data() as CashflowResponse
    // Reject if older than 14 days (weekly cron + buffer for outages)
    const generatedAt = new Date(data.generatedAt).getTime()
    if (Date.now() - generatedAt > 14 * 24 * 60 * 60 * 1000) return null
    return data
  } catch (err) {
    console.warn('[cashflow] Firestore read failed:', err)
    return null
  }
}

export async function fetchCashflow(): Promise<CashflowResponse | null> {
  const fresh = await fetchFromFirestore()
  if (fresh) {
    setCache(CACHE_KEY, fresh)
    return fresh
  }
  const cached = getCache<CashflowResponse>(CACHE_KEY)
  if (cached) return cached
  return null
}
