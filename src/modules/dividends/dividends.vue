<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDividendsStore } from './store/dividends.store'
import { useInterestRateStore } from '@/modules/interest-rate/store/interest-rate.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import type { DividendStock } from './domain/dividends.types'

const { t } = useI18n()
const router = useRouter()
const store = useDividendsStore()
const rateStore = useInterestRateStore()
const inflationStore = useInflationStore()

onMounted(() => Promise.all([store.init(), rateStore.init(), inflationStore.init()]))

const search = ref('')
type Filter = 'all' | 'beatsRate' | 'beatsInflation'
const activeFilter = ref<Filter>('all')
const filters: Filter[] = ['all', 'beatsRate', 'beatsInflation']

const depositRate = computed(() => rateStore.depositRate?.rate ?? 0)

const filtered = computed(() => {
  return store.sortedByYield.filter((s: DividendStock) => {
    const matchesSearch =
      s.company.toLowerCase().includes(search.value.toLowerCase()) ||
      s.ticker.toLowerCase().includes(search.value.toLowerCase())

    if (activeFilter.value === 'beatsRate') return matchesSearch && s.dividendYield > depositRate.value
    if (activeFilter.value === 'beatsInflation')
      return matchesSearch && inflationStore.beatsInflation(s.countryCode, s.dividendYield)
    return matchesSearch
  })
})

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function goToCompany(ticker: string) {
  router.push(`/dividends/${ticker}`)
}

function yieldColor(stock: DividendStock): string {
  if (inflationStore.beatsInflation(stock.countryCode, stock.dividendYield))
    return 'text-emerald-600 dark:text-emerald-400'
  if (stock.dividendYield > depositRate.value) return 'text-cyan-600 dark:text-cyan-400'
  return 'text-gray-500 dark:text-gray-400'
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('dividends.title') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('dividends.subtitle') }}</p>
    </div>

    <!-- ECB Rate badge -->
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <div
        class="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2"
      >
        <FontAwesomeIcon icon="percent" class="text-xs text-violet-500 dark:text-violet-400" />
        <span class="text-sm text-violet-700 dark:text-violet-300">
          {{ t('dividends.ecbRateLabel') }}: <strong>{{ depositRate.toFixed(2) }}%</strong>
        </span>
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
        {{ t('dividends.legendBeatsInflation') }}
        <span class="ml-3 inline-block h-2 w-2 rounded-full bg-cyan-500"></span>
        {{ t('dividends.legendBeatsEcb') }}
      </div>
    </div>

    <!-- Controls -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <div class="relative">
        <FontAwesomeIcon
          icon="magnifying-glass"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500"
        />
        <input
          v-model="search"
          type="text"
          :placeholder="t('dividends.searchPlaceholder')"
          class="rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
        />
      </div>
      <div class="flex gap-2">
        <button
          v-for="f in filters"
          :key="f"
          class="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            activeFilter === f
              ? 'bg-violet-600 text-white'
              : 'border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-white'
          "
          @click="activeFilter = f"
        >
          {{ t(`dividends.filter${f.charAt(0).toUpperCase() + f.slice(1)}`) }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
      <FontAwesomeIcon icon="circle-notch" spin class="mr-2" />
      {{ t('dividends.loading') }}
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <!-- Table -->
    <div
      v-else
      class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800">
            <th
              class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ t('dividends.company') }}
            </th>
            <th
              class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ t('dividends.country') }}
            </th>
            <th
              class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ t('dividends.yield') }}
            </th>
            <th
              class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ t('dividends.sector') }}
            </th>
            <th
              class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ t('dividends.exchange') }}
            </th>
            <th
              class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
            >
              {{ t('dividends.status') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="stock in filtered"
            :key="stock.ticker"
            class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            @click="goToCompany(stock.ticker)"
          >
            <td class="px-6 py-4">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ stock.company }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ stock.ticker }}</p>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ countryFlag(stock.countryCode) }}</span>
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ stock.country }}</span>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="text-lg font-bold" :class="yieldColor(stock)">
                {{ stock.dividendYield.toFixed(1) }}%
              </span>
            </td>
            <td class="px-6 py-4">
              <span
                class="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
              >
                {{ stock.sector }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{{ stock.exchange }}</td>
            <td class="px-6 py-4">
              <div class="flex flex-col gap-1">
                <span
                  v-if="stock.dividendYield > depositRate"
                  class="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400"
                >
                  <FontAwesomeIcon icon="check" />
                  {{ t('dividends.beatsEcb') }}
                </span>
                <span
                  v-if="inflationStore.beatsInflation(stock.countryCode, stock.dividendYield)"
                  class="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <FontAwesomeIcon icon="trophy" />
                  {{ t('dividends.beatsInflation') }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="filtered.length === 0"
        class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {{ t('dividends.noResults') }}
      </div>
    </div>
  </div>
</template>
