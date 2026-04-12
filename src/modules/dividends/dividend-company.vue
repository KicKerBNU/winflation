<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Chart, registerables } from 'chart.js'
import { fetchCompanyDetail } from './api/dividends.api'
import { useInterestRateStore } from '@/modules/interest-rate/store/interest-rate.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import { useThemeStore } from '@/modules/theme/store/theme.store'
import type { CompanyDetail } from './domain/dividends.types'

Chart.register(...registerables)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const rateStore = useInterestRateStore()
const inflationStore = useInflationStore()
const themeStore = useThemeStore()

const ticker = computed(() => (route.params.ticker as string).toUpperCase())
const company = ref<CompanyDetail | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const depositRate = computed(() => rateStore.depositRate?.rate ?? 0)
const localInflation = computed(() => {
  const entry = inflationStore.countries.find(
    (c) => c.countryCode === company.value?.countryCode,
  )
  return entry?.rate ?? null
})

// ── PRO / CON logic ────────────────────────────────────────────────────────────
const CYCLICAL_SECTORS = ['Consumer Cyclical', 'Basic Materials', 'Energy', 'Real Estate']
const STABLE_SECTORS = ['Utilities', 'Financial Services', 'Healthcare', 'Consumer Defensive']

const proScenario = computed<{ key: string; params: Record<string, string | number> }>(() => {
  const c = company.value
  if (!c) return { key: 'established', params: {} }
  const inf = localInflation.value
  if (inf !== null && c.dividendYield > inf)
    return { key: 'beatsInflation', params: { yield: c.dividendYield.toFixed(1), inflation: inf.toFixed(1) } }
  if (c.dividendYield > depositRate.value)
    return { key: 'beatsEcb', params: { yield: c.dividendYield.toFixed(1), rate: depositRate.value.toFixed(2) } }
  if (STABLE_SECTORS.includes(c.sector))
    return { key: 'stableSector', params: { sector: c.sector } }
  if (c.beta < 0.8)
    return { key: 'lowBeta', params: { beta: c.beta.toFixed(1) } }
  return { key: 'established', params: { cap: formatMarketCap(c.marketCap) } }
})

const conScenario = computed<{ key: string; params: Record<string, string | number> }>(() => {
  const c = company.value
  if (!c) return { key: 'concentration', params: {} }
  if (c.dividendYield > 8)
    return { key: 'highYield', params: { yield: c.dividendYield.toFixed(1) } }
  if (CYCLICAL_SECTORS.includes(c.sector))
    return { key: 'cyclical', params: { sector: c.sector } }
  if (c.beta > 1.2)
    return { key: 'highBeta', params: { beta: c.beta.toFixed(1) } }
  if (c.dividendYield < depositRate.value)
    return { key: 'belowEcb', params: { rate: depositRate.value.toFixed(2) } }
  return { key: 'concentration', params: {} }
})

// ── Chart ──────────────────────────────────────────────────────────────────────
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function buildChart() {
  if (!chartCanvas.value || !company.value) return
  chartInstance?.destroy()

  const isDark = themeStore.isDark
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? '#9ca3af' : '#6b7280'

  const labels = [
    t('dividendCompany.yieldLabel'),
    t('dividendCompany.ecbRateLabel'),
    ...(localInflation.value !== null ? [t('dividendCompany.inflationLabel')] : []),
  ]
  const values = [
    company.value.dividendYield,
    depositRate.value,
    ...(localInflation.value !== null ? [localInflation.value] : []),
  ]
  const colors = ['#7c3aed', '#06b6d4', '#10b981']

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, values.length),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(2)}%` },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: labelColor, callback: (v) => `${v}%` },
        },
        y: {
          grid: { display: false },
          ticks: { color: labelColor },
        },
      },
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMarketCap(n: number): string {
  if (n >= 1e12) return `€${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`
  return `€${n}`
}

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([rateStore.init(), inflationStore.init()])
  try {
    company.value = await fetchCompanyDetail(ticker.value)
  } catch {
    error.value = t('dividendCompany.error')
  } finally {
    isLoading.value = false
  }
})

watch(isLoading, (loading) => {
  if (!loading && company.value) nextTick(() => buildChart())
})

watch(() => themeStore.isDark, () => {
  if (company.value) buildChart()
})
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <!-- Back -->
    <button
      class="mb-6 flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400"
      @click="router.push('/dividends')"
    >
      <FontAwesomeIcon icon="arrow-left" />
      {{ t('dividendCompany.back') }}
    </button>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="animate-pulse space-y-6">
      <div class="flex items-center gap-4">
        <div class="h-16 w-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div class="space-y-2">
          <div class="h-6 w-56 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="i in 6" :key="i" class="h-24 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </div>
      <div class="h-48 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      <div class="h-32 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      <div class="grid grid-cols-2 gap-4">
        <div class="h-32 rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div class="h-32 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ error }}
    </div>

    <!-- Content -->
    <template v-else-if="company">
      <!-- Company header -->
      <div class="mb-8 flex flex-wrap items-start gap-4">
        <img
          v-if="company.image"
          :src="company.image"
          :alt="company.company"
          class="h-16 w-16 rounded-xl border border-gray-200 bg-white object-contain p-1 dark:border-gray-700 dark:bg-gray-900"
        />
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ company.company }}</h1>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span class="font-mono font-semibold text-violet-600 dark:text-violet-400">{{ company.ticker }}</span>
            <span>·</span>
            <span>{{ company.sector }}</span>
            <span>·</span>
            <span>{{ company.exchange }}</span>
            <span>·</span>
            <span>{{ countryFlag(company.countryCode) }} {{ company.country }}</span>
          </div>
        </div>
      </div>

      <!-- Stats cards -->
      <div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <!-- Price -->
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dividendCompany.price') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {{ company.currency }} {{ company.price.toFixed(2) }}
          </p>
          <p
            class="mt-0.5 flex items-center gap-1 text-xs"
            :class="company.priceChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
          >
            <FontAwesomeIcon :icon="company.priceChange >= 0 ? 'arrow-up' : 'arrow-down'" class="text-[10px]" />
            {{ Math.abs(company.priceChangePercent).toFixed(2) }}%
          </p>
        </div>

        <!-- Yield -->
        <div class="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800/40 dark:bg-violet-900/20">
          <p class="text-xs text-violet-500 dark:text-violet-400">{{ t('dividendCompany.yieldLabel') }}</p>
          <p class="mt-1 text-xl font-bold text-violet-700 dark:text-violet-300">
            {{ company.dividendYield.toFixed(2) }}%
          </p>
          <p class="mt-0.5 text-xs text-violet-400 dark:text-violet-500">
            {{ company.currency }} {{ company.annualDividend.toFixed(2) }}/yr
          </p>
        </div>

        <!-- Market Cap -->
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dividendCompany.marketCap') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ formatMarketCap(company.marketCap) }}</p>
        </div>

        <!-- Beta -->
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dividendCompany.beta') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ company.beta.toFixed(2) }}</p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {{ company.beta < 1 ? t('dividendCompany.betaLow') : t('dividendCompany.betaHigh') }}
          </p>
        </div>

        <!-- 52-week high -->
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dividendCompany.weekHigh') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ company.rangeHigh.toFixed(2) }}</p>
        </div>

        <!-- 52-week low -->
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dividendCompany.weekLow') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ company.rangeLow.toFixed(2) }}</p>
        </div>
      </div>

      <!-- Yield vs benchmarks chart -->
      <div class="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('dividendCompany.chartTitle') }}
        </h2>
        <div class="h-40">
          <canvas ref="chartCanvas" />
        </div>
      </div>

      <!-- About + CEO/website -->
      <div class="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('dividendCompany.about') }} {{ company.company }}
        </h2>
        <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{{ company.description }}</p>
        <div class="mt-4 flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400">
          <span v-if="company.ceo" class="flex items-center gap-2">
            <FontAwesomeIcon icon="user" class="text-xs text-gray-400" />
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('dividendCompany.ceoLabel') }}:</span>
            {{ company.ceo }}
          </span>
          <span v-if="company.industry" class="flex items-center gap-2">
            <FontAwesomeIcon icon="building" class="text-xs text-gray-400" />
            {{ company.industry }}
          </span>
          <a
            v-if="company.website"
            :href="company.website"
            target="_blank"
            rel="noopener noreferrer"
            class="flex cursor-pointer items-center gap-2 text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
          >
            <FontAwesomeIcon icon="arrow-up-right-from-square" class="text-xs" />
            {{ t('dividendCompany.websiteLabel') }}
          </a>
        </div>
      </div>

      <!-- PRO / CON -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- PRO -->
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <div class="mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon="thumbs-up" class="text-emerald-600 dark:text-emerald-400" />
            <h3 class="font-semibold text-emerald-700 dark:text-emerald-300">{{ t('dividendCompany.proTitle') }}</h3>
          </div>
          <p class="text-sm leading-relaxed text-emerald-700 dark:text-emerald-300">
            {{ t(`dividendCompany.pro.${proScenario.key}`, proScenario.params) }}
          </p>
        </div>

        <!-- CON -->
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800/40 dark:bg-red-900/20">
          <div class="mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon="thumbs-down" class="text-red-500 dark:text-red-400" />
            <h3 class="font-semibold text-red-700 dark:text-red-300">{{ t('dividendCompany.conTitle') }}</h3>
          </div>
          <p class="text-sm leading-relaxed text-red-700 dark:text-red-300">
            {{ t(`dividendCompany.con.${conScenario.key}`, conScenario.params) }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
