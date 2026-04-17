<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Filler,
  Tooltip,
} from 'chart.js'
import { fetchCountryHistory } from './api/inflation.api'
import { fetchCountryDebt, fetchCountryEconomicAnalysis } from './api/country-insights.api'
import { useThemeStore } from '@/modules/theme/store/theme.store'
import type { InflationDataPoint, CountryDebt, CountryEconomicAnalysis } from './domain/inflation.types'

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Filler, Tooltip)

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

const countryCode = computed(() => (route.params.countryCode as string).toUpperCase())
const countryName = ref('')
const points = ref<InflationDataPoint[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const debt = ref<CountryDebt | null>(null)
const analysis = ref<CountryEconomicAnalysis | null>(null)
const isLoadingInsights = ref(true)

const inflationCanvasRef = ref<HTMLCanvasElement | null>(null)
const debtCanvasRef = ref<HTMLCanvasElement | null>(null)
let inflationChart: Chart | null = null
let debtChart: Chart | null = null

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

const latest = computed(() => points.value[points.value.length - 1])
const highest = computed(() => points.value.reduce((a, b) => (b.rate > a.rate ? b : a), points.value[0] ?? { date: '', rate: 0 }))
const lowest = computed(() => points.value.reduce((a, b) => (b.rate < a.rate ? b : a), points.value[0] ?? { date: '', rate: 0 }))
const average = computed(() => {
  if (!points.value.length) return 0
  return +(points.value.reduce((s, p) => s + p.rate, 0) / points.value.length).toFixed(2)
})

const debtTrend = computed(() => {
  if (!debt.value || debt.value.history.length < 2) return null
  const h = debt.value.history
  const diff = h[h.length - 1].debtPct - h[0].debtPct
  return { diff: +diff.toFixed(1), up: diff > 0 }
})

function isDark() { return themeStore.isDark }

function getChartColors() {
  return isDark()
    ? { line: '#a78bfa', fill: 'rgba(167,139,250,0.12)', grid: 'rgba(255,255,255,0.05)', tick: '#6b7280', tooltip: '#1f2937', tooltipText: '#f9fafb', border: '#374151' }
    : { line: '#7c3aed', fill: 'rgba(124,58,237,0.07)', grid: 'rgba(0,0,0,0.05)', tick: '#9ca3af', tooltip: '#ffffff', tooltipText: '#111827', border: '#e5e7eb' }
}

function getDebtChartColors() {
  return isDark()
    ? { line: '#f59e0b', fill: 'rgba(245,158,11,0.10)', grid: 'rgba(255,255,255,0.05)', tick: '#6b7280', tooltip: '#1f2937', tooltipText: '#f9fafb', border: '#374151' }
    : { line: '#d97706', fill: 'rgba(217,119,6,0.07)', grid: 'rgba(0,0,0,0.05)', tick: '#9ca3af', tooltip: '#ffffff', tooltipText: '#111827', border: '#e5e7eb' }
}

function buildInflationChart() {
  if (!inflationCanvasRef.value || !points.value.length) return
  if (inflationChart) { inflationChart.destroy(); inflationChart = null }
  const c = getChartColors()
  inflationChart = new Chart(inflationCanvasRef.value, {
    type: 'line',
    data: {
      labels: points.value.map((p) => p.date),
      datasets: [{
        data: points.value.map((p) => p.rate),
        borderColor: c.line, backgroundColor: c.fill,
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
        pointHoverBackgroundColor: c.line, fill: true, tension: 0.3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tooltip, titleColor: c.tooltipText, bodyColor: c.tooltipText,
          borderColor: c.border, borderWidth: 1, padding: 10,
          callbacks: { label: (ctx) => ` ${(ctx.parsed.y ?? 0).toFixed(2)}%` },
        },
      },
      scales: {
        x: { ticks: { color: c.tick, maxTicksLimit: 12, maxRotation: 0 }, grid: { color: c.grid } },
        y: { ticks: { color: c.tick, callback: (v) => `${v}%` }, grid: { color: c.grid } },
      },
    },
  })
}

function buildDebtChart() {
  if (!debtCanvasRef.value || !debt.value?.history.length) return
  if (debtChart) { debtChart.destroy(); debtChart = null }
  const c = getDebtChartColors()
  debtChart = new Chart(debtCanvasRef.value, {
    type: 'line',
    data: {
      labels: debt.value.history.map((d) => d.year),
      datasets: [{
        data: debt.value.history.map((d) => d.debtPct),
        borderColor: c.line, backgroundColor: c.fill,
        borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: c.line,
        pointHoverRadius: 5, pointHoverBackgroundColor: c.line, fill: true, tension: 0.4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tooltip, titleColor: c.tooltipText, bodyColor: c.tooltipText,
          borderColor: c.border, borderWidth: 1, padding: 10,
          callbacks: { label: (ctx) => ` ${(ctx.parsed.y ?? 0).toFixed(1)}% of GDP` },
        },
      },
      scales: {
        x: { ticks: { color: c.tick, maxRotation: 0 }, grid: { color: c.grid } },
        y: { ticks: { color: c.tick, callback: (v) => `${v}%` }, grid: { color: c.grid } },
      },
    },
  })
}

async function load() {
  isLoading.value = true
  error.value = null
  try {
    const result = await fetchCountryHistory(countryCode.value)
    points.value = result.points
    countryName.value = result.countryName
  } catch {
    error.value = t('inflationCountry.error')
  } finally {
    isLoading.value = false
  }
}

async function loadInsights() {
  isLoadingInsights.value = true
  try {
    const [debtResult, analysisResult] = await Promise.all([
      fetchCountryDebt(countryCode.value),
      fetchCountryEconomicAnalysis(countryCode.value, countryName.value || countryCode.value, locale.value),
    ])
    debt.value = debtResult
    analysis.value = analysisResult
  } catch {
    // insights are non-critical
  } finally {
    isLoadingInsights.value = false
  }
}

onMounted(async () => {
  await load()
  buildInflationChart()
  loadInsights()
})

watch(() => themeStore.isDark, () => {
  buildInflationChart()
  buildDebtChart()
})

watch(isLoadingInsights, (loading) => {
  if (!loading && debt.value) {
    setTimeout(() => buildDebtChart(), 0)
  }
})

watch(isLoading, (loading) => {
  if (!loading && points.value.length) {
    setTimeout(() => buildInflationChart(), 0)
  }
})

onBeforeUnmount(() => {
  inflationChart?.destroy()
  debtChart?.destroy()
})
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">

    <!-- Back -->
    <button
      class="mb-6 flex cursor-pointer items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
      @click="router.push('/inflation')"
    >
      <FontAwesomeIcon icon="arrow-left" class="text-xs" />
      {{ t('inflationCountry.back') }}
    </button>

    <!-- Hero header -->
    <div class="mb-8 flex items-center gap-4">
      <span class="text-5xl leading-none">{{ countryFlag(countryCode) }}</span>
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {{ countryName || countryCode }}
        </h1>
        <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">{{ t('inflationCountry.subtitle') }}</p>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="isLoading" class="space-y-6">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-2 h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div class="mb-1.5 h-7 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ error }}
    </div>

    <template v-else-if="points.length">

      <!-- Stats row -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.latest') }}</p>
          <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ latest?.rate.toFixed(1) }}%</p>
          <p class="mt-1 text-xs text-gray-400">{{ latest?.date }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.average') }}</p>
          <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ average }}%</p>
          <p class="mt-1 text-xs text-gray-400">{{ t('inflationCountry.tenYears') }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.peak') }}</p>
          <p class="mt-2 text-3xl font-bold text-red-500 dark:text-red-400">{{ highest?.rate.toFixed(1) }}%</p>
          <p class="mt-1 text-xs text-gray-400">{{ highest?.date }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.low') }}</p>
          <p class="mt-2 text-3xl font-bold text-emerald-500 dark:text-emerald-400">{{ lowest?.rate.toFixed(1) }}%</p>
          <p class="mt-1 text-xs text-gray-400">{{ lowest?.date }}</p>
        </div>
      </div>

      <!-- Inflation chart -->
      <div class="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <p class="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.chartTitle') }}</p>
        <div class="h-56">
          <canvas ref="inflationCanvasRef" />
        </div>
      </div>

      <!-- Insights: debt + AI -->
      <div v-if="isLoadingInsights" class="space-y-6">
        <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-4 h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          <div v-for="i in 3" :key="i" class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div class="mb-4 h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div class="space-y-3">
              <div v-for="j in 5" :key="j" class="flex items-start gap-3">
                <div class="h-5 w-5 flex-shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
                <div class="h-3 flex-1 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <!-- Debt chart -->
        <div v-if="debt" class="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-5 flex items-start justify-between">
            <div>
              <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.debtLabel') }}</p>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ debt.current.debtPct }}%</span>
                <span class="text-sm text-gray-400">{{ t('inflationCountry.debtOfGdp') }}</span>
              </div>
            </div>
            <div v-if="debtTrend" class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              :class="debtTrend.up
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'"
            >
              <FontAwesomeIcon :icon="debtTrend.up ? 'arrow-trend-up' : 'arrow-trend-down'" class="text-xs" />
              {{ debtTrend.up ? '+' : '' }}{{ debtTrend.diff }}% {{ t('inflationCountry.debtSince', { year: debt.history[0].year }) }}
            </div>
          </div>
          <div class="h-48">
            <canvas ref="debtCanvasRef" />
          </div>
        </div>

        <!-- AI Economic Briefing -->
        <div v-if="analysis">
          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <FontAwesomeIcon icon="robot" class="text-sm text-violet-500" />
            </div>
            <div>
              <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('inflationCountry.aiInsightsTitle') }}</h2>
            </div>
            <span class="ml-auto rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
              {{ analysis.generatedAt }}
            </span>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">

            <!-- Priorities -->
            <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div class="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <FontAwesomeIcon icon="circle-info" class="text-xs text-violet-600 dark:text-violet-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('inflationCountry.prioritiesTitle') }}</h3>
              </div>
              <div class="divide-y divide-gray-50 px-5 dark:divide-gray-800">
                <div
                  v-for="(item, i) in analysis.priorities"
                  :key="i"
                  class="flex items-start gap-3 py-3.5"
                >
                  <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    {{ i + 1 }}
                  </span>
                  <p class="text-sm leading-snug text-gray-600 dark:text-gray-300">{{ item }}</p>
                </div>
              </div>
            </div>

            <!-- Problems -->
            <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div class="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <FontAwesomeIcon icon="arrow-trend-down" class="text-xs text-red-500 dark:text-red-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('inflationCountry.problemsTitle') }}</h3>
              </div>
              <div class="divide-y divide-gray-50 px-5 dark:divide-gray-800">
                <div
                  v-for="(item, i) in analysis.problems"
                  :key="i"
                  class="flex items-start gap-3 py-3.5"
                >
                  <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-500 dark:bg-red-900/30 dark:text-red-400">
                    {{ i + 1 }}
                  </span>
                  <p class="text-sm leading-snug text-gray-600 dark:text-gray-300">{{ item }}</p>
                </div>
              </div>
            </div>

            <!-- Opportunities -->
            <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div class="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <FontAwesomeIcon icon="arrow-trend-up" class="text-xs text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('inflationCountry.opportunitiesTitle') }}</h3>
              </div>
              <div class="divide-y divide-gray-50 px-5 dark:divide-gray-800">
                <div
                  v-for="(item, i) in analysis.opportunities"
                  :key="i"
                  class="flex items-start gap-3 py-3.5"
                >
                  <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {{ i + 1 }}
                  </span>
                  <p class="text-sm leading-snug text-gray-600 dark:text-gray-300">{{ item }}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </template>
    </template>
  </div>
</template>
