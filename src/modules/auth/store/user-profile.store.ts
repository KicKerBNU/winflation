import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import { setTaxCountry, subscribeToProfile } from '../api/user-profile.api'
import type { UserProfile } from '../domain/user-profile.types'
import { useAuthStore } from './auth.store'

export const useUserProfileStore = defineStore('user-profile', () => {
  const profile = ref<UserProfile>({ taxCountryCode: null })
  const isLoaded = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  const taxCountryCode = computed(() => profile.value.taxCountryCode ?? null)
  const hasTaxCountry = computed(() => !!profile.value.taxCountryCode)

  let unsubscribe: Unsubscribe | null = null
  let started = false

  function teardown() {
    unsubscribe?.()
    unsubscribe = null
    profile.value = { taxCountryCode: null }
    isLoaded.value = false
  }

  function init() {
    if (started) return
    started = true
    const auth = useAuthStore()
    auth.init()
    watch(
      () => auth.user?.uid ?? null,
      (uid) => {
        teardown()
        if (!uid) return
        unsubscribe = subscribeToProfile(
          uid,
          (next) => {
            profile.value = next
            isLoaded.value = true
            error.value = null
          },
          (err) => {
            error.value = err.message
            isLoaded.value = true
          },
        )
      },
      { immediate: true },
    )
  }

  async function saveTaxCountry(countryCode: string | null) {
    const auth = useAuthStore()
    if (!auth.user?.uid) {
      throw new Error('Not authenticated — cannot save profile.')
    }
    isSaving.value = true
    error.value = null
    try {
      await setTaxCountry(auth.user.uid, countryCode)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      isSaving.value = false
    }
  }

  return {
    profile,
    taxCountryCode,
    hasTaxCountry,
    isLoaded,
    isSaving,
    error,
    init,
    saveTaxCountry,
  }
})
