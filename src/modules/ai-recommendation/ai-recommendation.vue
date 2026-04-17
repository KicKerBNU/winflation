<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiRecommendationStore } from './store/ai-recommendation.store'
import type { AiCompany, YearlyYield, CompanyStatus } from './domain/ai-recommendation.types'

const { t } = useI18n()
const store = useAiRecommendationStore()

onMounted(() => store.init())

const formattedDate = computed(() => {
  if (!store.data?.generatedAt) return ''
  return new Date(store.data.generatedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `€${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`
  return `€${n}`
}

function maxYield(company: AiCompany): number {
  return Math.max(...company.historicYields.map((h) => h.yield), 0.1)
}

function barHeight(h: YearlyYield, company: AiCompany): string {
  return `${Math.max((h.yield / maxYield(company)) * 56, 4)}px`
}

const statusConfig: Record<CompanyStatus, { label: string; icon: string; cardBorder: string; badgeBg: string; badgeText: string }> = {
  bullish: {
    label: 'aiRecommendation.statusBullish',
    icon: 'arrow-trend-up',
    cardBorder: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  neutral: {
    label: 'aiRecommendation.statusNeutral',
    icon: 'minus',
    cardBorder: 'border-l-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  bearish: {
    label: 'aiRecommendation.statusBearish',
    icon: 'arrow-trend-down',
    cardBorder: 'border-l-red-500',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
    badgeText: 'text-red-700 dark:text-red-300',
  },
}
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">

    <!-- Header -->
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="mb-2 flex items-center gap-3">
          <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 shadow-lg shadow-violet-500/20">
            <FontAwesomeIcon icon="robot" class="text-white" />
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('aiRecommendation.title') }}</h1>
        </div>
        <p class="ml-13 text-sm text-gray-500 dark:text-gray-400">{{ t('aiRecommendation.subtitle') }}</p>
      </div>
      <div v-if="store.data" class="flex flex-col items-end gap-2">
        <span class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <FontAwesomeIcon icon="calendar" class="text-xs" />
          {{ t('aiRecommendation.updatedAt', { date: formattedDate }) }}
        </span>
        <span class="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-300">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500"></span>
          {{ t('aiRecommendation.refreshesDaily') }}
        </span>
      </div>
    </div>

    <!-- Loading skeletons -->
    <div v-if="store.isLoading" class="space-y-6">
      <div
        v-for="i in 10"
        :key="i"
        class="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="border-l-4 border-l-gray-200 p-6 dark:border-l-gray-700">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div class="h-5 w-44 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div class="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
          <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div v-for="j in 4" :key="j" class="h-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
          </div>
          <div class="h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!store.data"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
        <FontAwesomeIcon icon="robot" class="text-2xl text-violet-500 dark:text-violet-400" />
      </div>
      <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('aiRecommendation.empty') }}</p>
    </div>

    <!-- Company cards -->
    <div v-else class="space-y-6">
      <div
        v-for="company in store.data.companies"
        :key="company.ticker"
        class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="border-l-4 p-5 sm:p-6" :class="statusConfig[company.status].cardBorder">

          <!-- Card header -->
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <!-- Rank badge -->
              <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {{ company.rank }}
              </span>
              <!-- Company logo -->
              <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
                <img
                  :src="`https://logo.clearbit.com/${company.website}`"
                  :alt="company.company"
                  class="h-full w-full object-contain"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
              </div>
              <div>
                <h2 class="text-base font-bold text-gray-900 dark:text-white">{{ company.company }}</h2>
                <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span class="font-mono font-semibold text-violet-600 dark:text-violet-400">{{ company.ticker }}</span>
                  <span>·</span>
                  <span>{{ countryFlag(company.countryCode) }} {{ company.country }}</span>
                  <span>·</span>
                  <span>{{ company.sector }}</span>
                  <span class="hidden sm:inline">·</span>
                  <span class="hidden sm:inline">{{ company.exchange }}</span>
                </div>
              </div>
            </div>
            <!-- Status badge -->
            <span
              class="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              :class="[statusConfig[company.status].badgeBg, statusConfig[company.status].badgeText]"
            >
              <FontAwesomeIcon :icon="statusConfig[company.status].icon" class="text-[10px]" />
              {{ t(statusConfig[company.status].label) }}
            </span>
          </div>

          <!-- Key metrics -->
          <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <!-- Yield -->
            <div class="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800/40 dark:bg-violet-900/20">
              <p class="text-xs text-violet-500 dark:text-violet-400">{{ t('aiRecommendation.yieldLabel') }}</p>
              <p class="mt-1 text-2xl font-bold text-violet-700 dark:text-violet-300">
                {{ company.dividendYield.toFixed(1) }}%
              </p>
              <p class="mt-0.5 text-xs text-violet-400 dark:text-violet-500">
                {{ formatPrice(company.annualDividend, company.currency) }}/yr
              </p>
            </div>

            <!-- Price -->
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.price') }}</p>
              <p class="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {{ formatPrice(company.currentPrice, company.currency) }}
              </p>
              <p
                class="mt-0.5 flex items-center gap-1 text-xs"
                :class="company.priceChangePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
              >
                <FontAwesomeIcon :icon="company.priceChangePercent >= 0 ? 'arrow-up' : 'arrow-down'" class="text-[9px]" />
                {{ Math.abs(company.priceChangePercent).toFixed(2) }}%
              </p>
            </div>

            <!-- Annual dividend -->
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.annualDiv') }}</p>
              <p class="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {{ formatPrice(company.annualDividend, company.currency) }}
              </p>
              <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">per share / year</p>
            </div>

            <!-- Market cap -->
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.marketCap') }}</p>
              <p class="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {{ formatMarketCap(company.marketCap) }}
              </p>
            </div>
          </div>

          <!-- Historical yield chart + dividends per year -->
          <div class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">

            <!-- Yield history bar chart -->
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <p class="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('aiRecommendation.yieldHistory') }}</p>
              <div class="flex items-end gap-2">
                <div
                  v-for="h in company.historicYields"
                  :key="h.year"
                  class="flex flex-1 flex-col items-center gap-1"
                >
                  <span class="text-[10px] font-medium text-violet-600 dark:text-violet-400">{{ h.yield.toFixed(1) }}%</span>
                  <div
                    class="w-full rounded-t-sm bg-violet-500 transition-all dark:bg-violet-400"
                    :style="{ height: barHeight(h, company) }"
                  />
                  <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ h.year }}</span>
                </div>
              </div>
            </div>

            <!-- Dividends per year table -->
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <p class="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('aiRecommendation.dividendsPerYear') }}</p>
              <div class="space-y-1.5">
                <div
                  v-for="d in [...company.dividendsPerYear].reverse()"
                  :key="d.year"
                  class="flex items-center justify-between text-xs"
                >
                  <span class="font-medium text-gray-600 dark:text-gray-300">{{ d.year }}</span>
                  <div class="flex items-center gap-3">
                    <span class="font-bold text-gray-900 dark:text-white">
                      {{ formatPrice(d.totalAmount, company.currency) }}
                    </span>
                    <span class="rounded-full border border-gray-200 px-2 py-0.5 text-gray-400 dark:border-gray-600 dark:text-gray-500">
                      {{ d.payments }}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pro / Con -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <!-- Pro -->
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20">
              <div class="mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon="thumbs-up" class="text-sm text-emerald-600 dark:text-emerald-400" />
                <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{{ t('aiRecommendation.proTitle') }}</span>
              </div>
              <p class="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">{{ company.pro }}</p>
            </div>

            <!-- Con -->
            <div class="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-900/20">
              <div class="mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon="thumbs-down" class="text-sm text-red-500 dark:text-red-400" />
                <span class="text-xs font-semibold text-red-700 dark:text-red-300">{{ t('aiRecommendation.conTitle') }}</span>
              </div>
              <p class="text-xs leading-relaxed text-red-700 dark:text-red-300">{{ company.con }}</p>
            </div>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>
