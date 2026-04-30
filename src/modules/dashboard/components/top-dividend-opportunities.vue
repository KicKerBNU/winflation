<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '../store/dashboard.store'

const { t } = useI18n()
const router = useRouter()
const store = useDashboardStore()

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}
</script>

<template>
  <div class="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('dashboard.topOpportunities') }}</h2>
      <button
        class="cursor-pointer text-xs text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
        @click="router.push('/dividends')"
      >
        {{ t('dashboard.viewAll') }} →
      </button>
    </div>
    <div class="space-y-3">
      <div
        v-for="stock in store.topStocks"
        :key="stock.ticker"
        class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
        @click="router.push(`/dividends/${stock.ticker}`)"
      >
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ countryFlag(stock.countryCode) }}</span>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ stock.company }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ stock.ticker }} · {{ stock.sector }}</p>
          </div>
        </div>
        <span class="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {{ stock.dividendYield.toFixed(1) }}%
        </span>
      </div>
    </div>
  </div>
</template>
