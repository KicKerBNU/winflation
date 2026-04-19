<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './store/auth.store'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')

function redirectTarget(): string {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/')) return redirect
  return '/'
}

async function submit() {
  try {
    await auth.signUpWithEmail(email.value, password.value, name.value)
    router.replace(redirectTarget())
  } catch {
    // error surfaced via auth.error
  }
}

async function google() {
  try {
    await auth.signInWithGoogle()
    router.replace(redirectTarget())
  } catch {
    // error surfaced via auth.error
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 dark:bg-gray-950">
    <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div class="mb-6 text-center">
        <RouterLink to="/" class="inline-block cursor-pointer">
          <span class="text-xl font-bold text-violet-600 dark:text-violet-400">winflation</span>
          <span class="text-gray-400 dark:text-gray-500">.eu</span>
        </RouterLink>
        <h1 class="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{{ t('auth.register.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('auth.register.subtitle') }}</p>
      </div>

      <button
        type="button"
        class="mb-4 flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        :disabled="auth.isLoading"
        @click="google"
      >
        <FontAwesomeIcon :icon="['fab', 'google']" />
        {{ t('auth.register.google') }}
      </button>

      <div class="my-6 flex items-center gap-3">
        <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
        <span class="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('auth.or') }}</span>
        <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="name" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('auth.name') }}
          </label>
          <input
            id="name"
            v-model="name"
            type="text"
            required
            autocomplete="name"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label for="email" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('auth.email') }}
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('auth.password') }}
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            minlength="6"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('auth.register.passwordHint') }}</p>
        </div>

        <p v-if="auth.error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {{ t(auth.error) }}
        </p>

        <button
          type="submit"
          class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="auth.isLoading"
        >
          <FontAwesomeIcon v-if="auth.isLoading" icon="spinner" class="animate-spin" />
          {{ t('auth.register.submit') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('auth.register.haveAccount') }}
        <RouterLink to="/login" class="cursor-pointer font-semibold text-violet-600 hover:underline dark:text-violet-400">
          {{ t('auth.register.signIn') }}
        </RouterLink>
      </p>
    </div>
  </div>
</template>
