<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFollowStore } from './store/follow.store'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import type { FollowedCompany } from './domain/follow.types'

const { t, d } = useI18n()
const follow = useFollowStore()
const auth = useAuthStore()
const router = useRouter()

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

function routeFor(entry: FollowedCompany) {
  if (entry.source === 'ai-pick') {
    return { name: 'ai-recommendation-detail', params: { ticker: encodeURIComponent(entry.ticker) } }
  }
  return { name: 'dividend-company', params: { ticker: encodeURIComponent(entry.ticker) } }
}

function goTo(entry: FollowedCompany) {
  router.push(routeFor(entry))
}

async function removeEntry(entry: FollowedCompany, event: Event) {
  event.stopPropagation()
  try {
    await follow.unfollow(entry.ticker)
  } catch {
    // surfaced via follow.error
  }
}

function formatDate(iso: string): string {
  try {
    return d(new Date(iso), 'short')
  } catch {
    return iso.split('T')[0]
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 pt-20 pb-10 lg:px-8 lg:pt-10">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('follow.listTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('follow.listSubtitle') }}</p>
    </header>

    <!-- Not logged in -->
    <div
      v-if="!auth.isAuthenticated"
      class="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900"
    >
      <FontAwesomeIcon icon="right-to-bracket" class="mb-3 text-2xl text-violet-500" />
      <p class="mb-4 text-gray-600 dark:text-gray-300">{{ t('follow.loginRequired') }}</p>
      <RouterLink
        to="/login"
        class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
      >
        {{ t('auth.menu.login') }}
      </RouterLink>
    </div>

    <!-- Logged in, loading -->
    <div
      v-else-if="!follow.isReady || follow.isLoading"
      class="text-center text-gray-500 dark:text-gray-400"
    >
      {{ t('follow.loading') }}
    </div>

    <!-- Logged in, empty -->
    <div
      v-else-if="follow.count === 0"
      class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <FontAwesomeIcon icon="star" class="mb-3 text-3xl text-amber-400" />
      <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('follow.emptyTitle') }}</p>
      <p class="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('follow.emptyBody') }}</p>
      <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
        <RouterLink
          to="/ai-recommendation"
          class="cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {{ t('nav.aiRecommendation') }}
        </RouterLink>
        <RouterLink
          to="/dividends"
          class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {{ t('nav.dividends') }}
        </RouterLink>
      </div>
    </div>

    <!-- List -->
    <div v-else class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="entry in follow.list"
        :key="entry.ticker"
        role="link"
        tabindex="0"
        class="group flex cursor-pointer items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-700/60 dark:hover:bg-violet-900/10"
        @click="goTo(entry)"
        @keydown.enter="goTo(entry)"
      >
        <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-lg dark:bg-violet-900/40">
          {{ countryFlag(entry.countryCode) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate font-semibold text-gray-900 dark:text-white">{{ entry.company }}</p>
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {{ entry.source === 'ai-pick' ? t('follow.sourceAi') : t('follow.sourceDividend') }}
            </span>
          </div>
          <p class="mt-0.5 font-mono text-xs text-violet-600 dark:text-violet-400">{{ entry.ticker }}</p>
          <p class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ entry.sector }} · {{ entry.exchange }}
          </p>
          <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {{ t('follow.followedOn', { date: formatDate(entry.followedAt) }) }}
          </p>
        </div>
        <button
          type="button"
          :aria-label="t('follow.unfollow')"
          class="flex-shrink-0 cursor-pointer rounded-lg p-2 text-amber-500 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
          @click="removeEntry(entry, $event)"
        >
          <FontAwesomeIcon icon="star" />
        </button>
      </div>
    </div>
  </div>
</template>
