<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInterestRateStore } from '@/modules/interest-rate/store/interest-rate.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import { useDividendsStore } from '@/modules/dividends/store/dividends.store'
import { useDashboardStore } from './store/dashboard.store'
import { useRouter } from 'vue-router'
import UpcomingExDividends from './components/upcoming-ex-dividends.vue'

const { t } = useI18n()
const router = useRouter()

const rateStore = useInterestRateStore()
const inflationStore = useInflationStore()
const dividendsStore = useDividendsStore()
const dashboardStore = useDashboardStore()

onMounted(async () => {
  await Promise.all([rateStore.init(), inflationStore.init(), dividendsStore.init(), dashboardStore.init()])
})

const depositRate = computed(() => rateStore.depositRate?.rate ?? 0)

const stocksAboveEcb = computed(
  () => dividendsStore.stocks.filter((s) => s.dividendYield > depositRate.value).length,
)

const stocksBeatingInflation = computed(
  () =>
    dividendsStore.stocks.filter((s) => inflationStore.beatsInflation(s.countryCode, s.dividendYield))
      .length,
)

const topStocks = computed(() => dividendsStore.sortedByYield.slice(0, 5))
const topInflation = computed(() => inflationStore.lowestInflation)

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}
</script>

<template>
  <div class="overflow-x-hidden p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <div class="mx-auto max-w-7xl">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('dashboard.title') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.subtitle') }}</p>
    </div>

    <!-- Upcoming ex-dividends -->
    <UpcomingExDividends />

    <!-- Stat cards -->
    <div class="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <!-- ECB Rate -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <FontAwesomeIcon icon="percent" class="text-violet-500 dark:text-violet-400" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.ecbRate') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ depositRate.toFixed(2) }}%</p>
        <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.depositFacility') }}</p>
      </div>

      <!-- Countries tracked -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
          <FontAwesomeIcon icon="earth-europe" class="text-cyan-500 dark:text-cyan-400" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.countriesTracked') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ inflationStore.countries.length }}</p>
        <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.europeanCountries') }}</p>
      </div>

      <!-- Stocks above ECB -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <FontAwesomeIcon icon="coins" class="text-emerald-500 dark:text-emerald-400" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.stocksAboveRate') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ stocksAboveEcb }}</p>
        <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.beatingEcbRate') }}</p>
      </div>

      <!-- Stocks beating inflation -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <FontAwesomeIcon icon="trophy" class="text-amber-500 dark:text-amber-400" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.beatingInflation') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ stocksBeatingInflation }}</p>
        <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.beatingLocalInflation') }}</p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Top dividend opportunities -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
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
            v-for="stock in topStocks"
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

      <!-- Highest inflation countries -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('dashboard.lowestInflation') }}</h2>
          <button
            class="cursor-pointer text-xs text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
            @click="router.push('/inflation')"
          >
            {{ t('dashboard.viewAll') }} →
          </button>
        </div>
        <div class="space-y-3">
          <div
            v-for="country in topInflation"
            :key="country.countryCode"
            class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            @click="router.push(`/inflation/${country.countryCode.toLowerCase()}`)"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ countryFlag(country.countryCode) }}</span>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ country.country }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">{{ country.date }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="country.trend === 'up'
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : country.trend === 'down'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
              >
                <FontAwesomeIcon
                  :icon="country.trend === 'up' ? 'arrow-up' : country.trend === 'down' ? 'arrow-down' : 'minus'"
                  class="text-[10px]"
                />
                {{ country.trend === 'up' ? t('dashboard.trendRising') : country.trend === 'down' ? t('dashboard.trendFalling') : t('dashboard.trendStable') }}
              </span>
              <span class="text-sm font-bold text-gray-900 dark:text-white">{{ country.rate.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div><!-- /max-w-7xl -->
  </div>
</template>
