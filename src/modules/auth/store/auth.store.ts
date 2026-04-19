import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/plugins/firebase'
import { computeInitials, toAuthUser, type AuthUser } from '../domain/auth.types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const initials = computed(() => computeInitials(user.value))
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')

  let unsubscribe: (() => void) | null = null
  let resolveReady: (() => void) | null = null
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  function init() {
    if (unsubscribe) return
    unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      user.value = fbUser ? toAuthUser(fbUser) : null
      if (!isInitialized.value) {
        isInitialized.value = true
        resolveReady?.()
      }
    })
  }

  function translateError(err: unknown): string {
    const code = (err as { code?: string })?.code ?? ''
    const map: Record<string, string> = {
      'auth/invalid-email': 'auth.errors.invalidEmail',
      'auth/user-disabled': 'auth.errors.userDisabled',
      'auth/user-not-found': 'auth.errors.invalidCredentials',
      'auth/wrong-password': 'auth.errors.invalidCredentials',
      'auth/invalid-credential': 'auth.errors.invalidCredentials',
      'auth/email-already-in-use': 'auth.errors.emailInUse',
      'auth/weak-password': 'auth.errors.weakPassword',
      'auth/popup-closed-by-user': 'auth.errors.popupClosed',
      'auth/cancelled-popup-request': 'auth.errors.popupClosed',
      'auth/network-request-failed': 'auth.errors.network',
      'auth/too-many-requests': 'auth.errors.tooManyRequests',
    }
    return map[code] ?? 'auth.errors.generic'
  }

  async function signInWithEmail(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      error.value = translateError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function signUpWithEmail(email: string, password: string, name: string) {
    isLoading.value = true
    error.value = null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const trimmed = name.trim()
      if (trimmed) {
        await updateProfile(cred.user, { displayName: trimmed })
        user.value = toAuthUser(cred.user)
      }
    } catch (err) {
      error.value = translateError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function signInWithGoogle() {
    isLoading.value = true
    error.value = null
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err) {
      error.value = translateError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  function clearError() {
    error.value = null
  }

  return {
    user,
    isInitialized,
    isLoading,
    error,
    isAuthenticated,
    initials,
    displayName,
    ready,
    init,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    clearError,
  }
})
