import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import {
  followCompany,
  subscribeToUserDoc,
  unfollowCompany,
} from '../api/follow.api'
import type { FollowedCompany } from '../domain/follow.types'

export const useFollowStore = defineStore('follow', () => {
  const tickers = ref<string[]>([])
  const meta = ref<Record<string, FollowedCompany>>({})
  const isLoading = ref(false)
  const isReady = ref(false)
  const error = ref<string | null>(null)

  const list = computed<FollowedCompany[]>(() =>
    tickers.value
      .map((t) => meta.value[t])
      .filter((m): m is FollowedCompany => !!m)
      .sort(
        (a, b) => new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime(),
      ),
  )

  const count = computed(() => tickers.value.length)

  function isFollowing(ticker: string): boolean {
    return tickers.value.includes(ticker)
  }

  let unsubscribe: Unsubscribe | null = null
  let started = false

  async function start() {
    if (started) return
    started = true
    const auth = useAuthStore()
    // Wait for Firebase auth to settle so we don't briefly treat an authed user as anonymous.
    await auth.ready
    // React to auth state changes — subscribe while logged in, clear on logout.
    watch(
      () => auth.user?.uid ?? null,
      (uid) => {
        unsubscribe?.()
        unsubscribe = null
        tickers.value = []
        meta.value = {}
        error.value = null
        if (!uid) {
          // Anonymous: nothing to fetch, state is known.
          isReady.value = true
          isLoading.value = false
          return
        }
        isReady.value = false
        isLoading.value = true
        unsubscribe = subscribeToUserDoc(
          uid,
          (data) => {
            tickers.value = data.followed ?? []
            meta.value = data.followedMeta ?? {}
            isLoading.value = false
            isReady.value = true
          },
          (err) => {
            error.value = err.message
            isLoading.value = false
            isReady.value = true
          },
        )
      },
      { immediate: true },
    )
  }

  async function follow(entry: FollowedCompany) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Must be logged in to follow.')
    // Optimistic update — the onSnapshot listener will reconcile.
    if (!tickers.value.includes(entry.ticker)) tickers.value = [...tickers.value, entry.ticker]
    meta.value = { ...meta.value, [entry.ticker]: entry }
    try {
      await followCompany(auth.user.uid, entry)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    }
  }

  async function unfollow(ticker: string) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Must be logged in to unfollow.')
    tickers.value = tickers.value.filter((t) => t !== ticker)
    const { [ticker]: _, ...rest } = meta.value
    meta.value = rest
    try {
      await unfollowCompany(auth.user.uid, ticker)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    }
  }

  async function toggle(entry: FollowedCompany) {
    if (isFollowing(entry.ticker)) {
      await unfollow(entry.ticker)
    } else {
      await follow(entry)
    }
  }

  return {
    tickers,
    meta,
    list,
    count,
    isLoading,
    isReady,
    error,
    isFollowing,
    start,
    follow,
    unfollow,
    toggle,
  }
})
