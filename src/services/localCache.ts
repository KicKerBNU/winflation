const TTL_MS = 24 * 60 * 60 * 1000

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export function getCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const entry: CacheEntry<T> = JSON.parse(raw)
  if (Date.now() > entry.expiresAt) {
    localStorage.removeItem(key)
    return null
  }
  return entry.data
}

export function setCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + TTL_MS }
  localStorage.setItem(key, JSON.stringify(entry))
}
