<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCashflowStore } from './store/cashflow.store'
import { getLogoUrl } from '@/services/logoManifest'
import type { CashflowPick, RiskTier, AssetClass } from './domain/cashflow.types'

const { t, locale } = useI18n()
const store = useCashflowStore()

store.init()

const search = ref('')
const minYield = ref(0)
const sortMode = ref<'yield-desc' | 'yield-asc' | 'market-cap' | 'risk'>('yield-desc')

const formattedDate = computed(() => {
  if (!store.generatedAt) return ''
  return new Date(store.generatedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const filtered = computed<CashflowPick[]>(() => {
  const q = search.value.trim().toLowerCase()
  let list = store.picks.filter((p) => {
    if (p.dividendYield < minYield.value) return false
    if (!q) return true
    return (
      p.ticker.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q)
    )
  })

  switch (sortMode.value) {
    case 'yield-asc':
      list = [...list].sort((a, b) => a.dividendYield - b.dividendYield)
      break
    case 'market-cap':
      list = [...list].sort((a, b) => b.marketCap - a.marketCap)
      break
    case 'risk': {
      const order: Record<RiskTier, number> = { low: 0, medium: 1, high: 2 }
      list = [...list].sort((a, b) => order[a.riskTier] - order[b.riskTier])
      break
    }
    default:
      list = [...list].sort((a, b) => b.dividendYield - a.dividendYield)
  }

  return list
})

function countryFlag(code: string | null): string {
  if (!code) return ''
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function formatPrice(amount: number, currency: string | null): string {
  if (!currency) return amount.toFixed(2)
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}

function formatMarketCap(n: number, currency: string | null): string {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : ''
  if (n >= 1e12) return `${sym}${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`
  return `${sym}${n}`
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso + 'T00:00:00Z').getTime()
  if (Number.isNaN(t)) return null
  const now = Date.now()
  return Math.round((t - now) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: 'short' })
}

const riskConfig: Record<RiskTier, { label: string; pill: string; icon: string }> = {
  low: {
    label: 'cashflow.riskLow',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'shield-halved',
  },
  medium: {
    label: 'cashflow.riskMedium',
    pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'shield-halved',
  },
  high: {
    label: 'cashflow.riskHigh',
    pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-300',
    icon: 'triangle-exclamation',
  },
}

const assetClassLabel: Record<AssetClass, string> = {
  'equity-reit': 'cashflow.assetEquityReit',
  'mortgage-reit': 'cashflow.assetMortgageReit',
  'bdc': 'cashflow.assetBdc',
  'energy-infra': 'cashflow.assetEnergyInfra',
  'stock': 'cashflow.assetStock',
  'etf': 'cashflow.assetEtf',
}

function exDivChip(p: CashflowPick): { text: string; tone: 'live' | 'soon' | 'idle' | 'none' } {
  const days = daysUntil(p.nextExDividendDate)
  if (days === null) return { text: t('cashflow.nextExDividendUnknown'), tone: 'none' }
  if (days === 0) return { text: t('cashflow.nextExDividendToday'), tone: 'live' }
  if (days < 0) {
    // Past — show last paid instead
    return p.lastDividendDate
      ? { text: t('cashflow.lastDividendOn', { date: formatDate(p.lastDividendDate) }), tone: 'idle' }
      : { text: t('cashflow.nextExDividendUnknown'), tone: 'none' }
  }
  if (days <= 14) return { text: t('cashflow.nextExDividendIn', { days }), tone: 'soon' }
  return { text: t('cashflow.nextExDividendOn', { date: formatDate(p.nextExDividendDate) }), tone: 'idle' }
}

function routeFor(ticker: string) {
  return { name: 'cashflow-detail', params: { ticker: encodeURIComponent(ticker) } }
}
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <div class="mx-auto max-w-6xl">

      <!-- Header -->
      <header class="mb-8">
        <div class="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <FontAwesomeIcon icon="calendar" class="text-[10px]" />
          <span>{{ t('cashflow.refreshesWeekly') }}</span>
          <template v-if="formattedDate">
            · <span>{{ t('cashflow.updatedAt', { date: formattedDate }) }}</span>
          </template>
        </div>
        <h1 class="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          {{ t('cashflow.title') }}
        </h1>
        <p class="mt-2 max-w-3xl text-sm text-gray-500 sm:text-base dark:text-gray-400">
          {{ t('cashflow.subtitle') }}
        </p>
      </header>

      <!-- Filters bar -->
      <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
        <!-- Search -->
        <label class="block flex-1">
          <span class="sr-only">{{ t('cashflow.searchPlaceholder') }}</span>
          <div class="relative">
            <FontAwesomeIcon
              icon="magnifying-glass"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"
            />
            <input
              v-model="search"
              type="search"
              :placeholder="t('cashflow.searchPlaceholder')"
              class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </label>

        <!-- Yield filter -->
        <label class="block lg:w-72">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ minYield > 0 ? t('cashflow.yieldFilterLabel') + ` ≥ ${minYield}%` : t('cashflow.yieldFilterAll') }}
          </span>
          <input
            v-model.number="minYield"
            type="range"
            min="0"
            max="20"
            step="0.5"
            class="block w-full cursor-pointer accent-emerald-600"
          />
        </label>

        <!-- Sort -->
        <label class="block lg:w-56">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ t('cashflow.sortLabel') }}
          </span>
          <select
            v-model="sortMode"
            class="block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="yield-desc">{{ t('cashflow.sortYieldDesc') }}</option>
            <option value="yield-asc">{{ t('cashflow.sortYieldAsc') }}</option>
            <option value="market-cap">{{ t('cashflow.sortMarketCap') }}</option>
            <option value="risk">{{ t('cashflow.sortRisk') }}</option>
          </select>
        </label>
      </div>

      <!-- States -->
      <div v-if="store.isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="h-44 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>

      <div
        v-else-if="store.error"
        class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
      >
        {{ store.error }}
      </div>

      <div
        v-else-if="!store.hasData"
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900"
      >
        <FontAwesomeIcon icon="calendar" class="mb-3 text-2xl text-gray-300" />
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('cashflow.empty') }}</p>
      </div>

      <template v-else>
        <p class="mb-3 text-xs uppercase tracking-widest text-gray-400">
          {{ t('cashflow.pickCount', { count: filtered.length }) }}
        </p>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="p in filtered"
            :key="p.ticker"
            :to="routeFor(p.ticker)"
            class="group flex cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-700"
          >
            <!-- Top: rank/risk + ex-div chip -->
            <div class="mb-3 flex items-start justify-between gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                :class="riskConfig[p.riskTier].pill"
              >
                <FontAwesomeIcon :icon="riskConfig[p.riskTier].icon" class="text-[9px]" />
                {{ t(riskConfig[p.riskTier].label) }}
              </span>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="{
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300': exDivChip(p).tone === 'live',
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300': exDivChip(p).tone === 'soon',
                  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400': exDivChip(p).tone === 'idle',
                  'bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500': exDivChip(p).tone === 'none',
                }"
              >
                <FontAwesomeIcon icon="calendar" class="text-[8px]" />
                {{ exDivChip(p).text }}
              </span>
            </div>

            <!-- Logo + name -->
            <div class="flex items-start gap-3">
              <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800">
                <img
                  v-if="getLogoUrl(p.ticker)"
                  :src="getLogoUrl(p.ticker)!"
                  :alt="p.company"
                  class="h-full w-full object-contain"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <FontAwesomeIcon v-else icon="building" class="text-base text-gray-300" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-base font-bold text-gray-900 dark:text-white">{{ p.company }}</h3>
                <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span class="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{{ p.ticker }}</span>
                  <span v-if="p.countryCode">·</span>
                  <span v-if="p.countryCode">{{ countryFlag(p.countryCode) }}</span>
                  <span>·</span>
                  <span>{{ t(assetClassLabel[p.assetClass]) }}</span>
                </div>
              </div>
            </div>

            <!-- Yield + facts -->
            <div class="mt-4 flex items-end justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
              <div>
                <div class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('cashflow.yieldLabel') }}</div>
                <div class="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {{ p.dividendYield.toFixed(2) }}<span class="text-base text-gray-400">%</span>
                </div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400">
                  {{ formatPrice(p.annualDividend, p.currency) }} / yr · {{ t('cashflow.paymentsPerYear', { n: p.paymentFrequency }) }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('cashflow.marketCap') }}</div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ formatMarketCap(p.marketCap, p.currency) }}</div>
                <div class="text-[11px] text-gray-400">{{ formatPrice(p.currentPrice, p.currency) }}</div>
              </div>
            </div>
          </RouterLink>
        </div>
      </template>

    </div>
  </div>
</template>
