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
import { useThemeStore } from '@/modules/theme/store/theme.store'
import type { InflationDataPoint } from './domain/inflation.types'

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Filler, Tooltip)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

const countryCode = computed(() => (route.params.countryCode as string).toUpperCase())
const countryName = ref('')
const points = ref<InflationDataPoint[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

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

function isDark() {
  return themeStore.isDark
}

function chartColors() {
  return isDark()
    ? { line: '#a78bfa', fill: 'rgba(167,139,250,0.12)', grid: 'rgba(255,255,255,0.06)', tick: '#9ca3af', tooltip: '#1f2937', tooltipText: '#f9fafb' }
    : { line: '#7c3aed', fill: 'rgba(124,58,237,0.08)', grid: 'rgba(0,0,0,0.06)', tick: '#6b7280', tooltip: '#ffffff', tooltipText: '#111827' }
}

function buildChart() {
  if (!canvasRef.value || !points.value.length) return
  if (chart) { chart.destroy(); chart = null }

  const colors = chartColors()
  const labels = points.value.map((p) => p.date)
  const data = points.value.map((p) => p.rate)

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: colors.line,
        backgroundColor: colors.fill,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors.line,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltip,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          borderColor: isDark() ? '#374151' : '#e5e7eb',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${(ctx.parsed.y ?? 0).toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: colors.tick,
            maxTicksLimit: 12,
            maxRotation: 0,
          },
          grid: { color: colors.grid },
        },
        y: {
          ticks: {
            color: colors.tick,
            callback: (v) => `${v}%`,
          },
          grid: { color: colors.grid },
        },
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

onMounted(async () => {
  await load()
  buildChart()
})

// Rebuild chart when theme changes
watch(() => themeStore.isDark, () => buildChart())

// Rebuild chart once data loads (canvas is ready after loading state resolves)
watch(isLoading, (loading) => {
  if (!loading && points.value.length) {
    // Wait for v-if to render the canvas
    setTimeout(() => buildChart(), 0)
  }
})

onBeforeUnmount(() => {
  chart?.destroy()
})
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <!-- Back button + header -->
    <div class="mb-8">
      <button
        class="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        @click="router.push('/inflation')"
      >
        <FontAwesomeIcon icon="arrow-left" />
        {{ t('inflationCountry.back') }}
      </button>

      <div class="flex items-center gap-3">
        <span class="text-4xl">{{ countryFlag(countryCode) }}</span>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ countryName || countryCode }}
          </h1>
          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {{ t('inflationCountry.subtitle') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="isLoading">
      <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div
          v-for="i in 4"
          :key="i"
          class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="mb-2 h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div class="mb-1.5 h-7 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div class="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
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
      <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.latest') }}</p>
          <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ latest?.rate.toFixed(1) }}%</p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ latest?.date }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.average') }}</p>
          <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ average }}%</p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ t('inflationCountry.tenYears') }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.peak') }}</p>
          <p class="mt-1 text-2xl font-bold text-red-500 dark:text-red-400">{{ highest?.rate.toFixed(1) }}%</p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ highest?.date }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{{ t('inflationCountry.low') }}</p>
          <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ lowest?.rate.toFixed(1) }}%</p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ lowest?.date }}</p>
        </div>
      </div>

      <!-- Chart -->
      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('inflationCountry.chartTitle') }}
        </h2>
        <div class="h-72">
          <canvas ref="canvasRef" />
        </div>
      </div>
    </template>
  </div>
</template>
