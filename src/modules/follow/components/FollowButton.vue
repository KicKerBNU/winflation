<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useFollowStore } from '../store/follow.store'
import type { FollowedCompany, FollowSource } from '../domain/follow.types'

interface Props {
  ticker: string
  company: string
  country: string
  countryCode: string
  sector: string
  exchange: string
  source: FollowSource
}

const props = defineProps<Props>()

const { t } = useI18n()
const auth = useAuthStore()
const follow = useFollowStore()
const router = useRouter()
const route = useRoute()

const isFollowing = computed(() => follow.isFollowing(props.ticker))

async function onClick() {
  if (!auth.isAuthenticated) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  const entry: FollowedCompany = {
    ticker: props.ticker,
    company: props.company,
    country: props.country,
    countryCode: props.countryCode,
    sector: props.sector,
    exchange: props.exchange,
    source: props.source,
    followedAt: new Date().toISOString(),
  }
  try {
    await follow.toggle(entry)
  } catch {
    // error surfaced via follow.error
  }
}
</script>

<template>
  <button
    type="button"
    :aria-label="isFollowing ? t('follow.unfollow') : t('follow.follow')"
    :disabled="!follow.isReady"
    class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
    :class="[
      !follow.isReady
        ? 'cursor-wait border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600'
        : isFollowing
          ? 'cursor-pointer border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40'
          : 'cursor-pointer border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
    ]"
    @click="onClick"
  >
    <FontAwesomeIcon
      v-if="!follow.isReady"
      icon="spinner"
      spin
      class="text-xs"
    />
    <FontAwesomeIcon
      v-else
      :icon="isFollowing ? 'star' : ['far', 'star']"
      class="text-xs"
    />
    {{ !follow.isReady ? t('follow.loading') : isFollowing ? t('follow.following') : t('follow.follow') }}
  </button>
</template>
