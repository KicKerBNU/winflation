<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Chart, registerables } from 'chart.js'
import { useAiRecommendationStore } from './store/ai-recommendation.store'
import { useThemeStore } from '@/modules/theme/store/theme.store'
import FollowButton from '@/modules/follow/components/FollowButton.vue'
import type { AiCompanyCard, CompanyStatus, LocalizedText, YearlyYield } from './domain/ai-recommendation.types'

Chart.register(...registerables)

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAiRecommendationStore()
const themeStore = useThemeStore()

const SERIF = "ui-serif, Georgia, 'Times New Roman', serif"

const ticker = computed(() => decodeURIComponent(route.params.ticker as string))
const company = computed<AiCompanyCard | null>(
  () => store.cards.find((c) => c.ticker === ticker.value) ?? null,
)

const notFound = computed(() => !store.isLoading && store.hasData && !company.value)

onMounted(() => {
  store.init()
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

/** Chart.js tick values can carry float noise (e.g. 1.8000000000000003); cap at 2 decimal places for display. */
function formatPercentTick(v: number | string): string {
  const n = Math.round(Number(v) * 100) / 100
  return `${parseFloat(n.toFixed(2))}%`
}

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `€${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`
  return `€${n}`
}

function localized(text: LocalizedText | undefined): string {
  if (!text) return ''
  return text[locale.value as keyof LocalizedText] ?? text['en-US']
}

function maxYield(values: YearlyYield[]): number {
  return Math.max(...values.map((h) => h.yield), 0.1)
}

function barHeightPx(h: YearlyYield, values: YearlyYield[], max: number): string {
  return `${Math.max((h.yield / maxYield(values)) * max, 4)}px`
}

const statusConfig: Record<CompanyStatus, { label: string; dot: string; bg: string; text: string; icon: string }> = {
  bullish: {
    label: 'aiRecommendation.statusBullish',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'arrow-trend-up',
  },
  neutral: {
    label: 'aiRecommendation.statusNeutral',
    dot: 'bg-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'minus',
  },
  bearish: {
    label: 'aiRecommendation.statusBearish',
    dot: 'bg-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    icon: 'arrow-trend-down',
  },
}

// ── Evolution line chart ──────────────────────────────────────────────────────
const evolutionCanvas = ref<HTMLCanvasElement | null>(null)
let evolutionChart: Chart | null = null

function buildEvolutionChart() {
  if (!evolutionCanvas.value || !company.value?.historicYields) return
  evolutionChart?.destroy()

  const isDark = themeStore.isDark
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? '#9ca3af' : '#6b7280'

  const rows = company.value.historicYields
  const labels = rows.map((r) => String(r.year))
  const yields = rows.map((r) => r.yield)
  const dividends = rows.map((r) => r.dividend)

  evolutionChart = new Chart(evolutionCanvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('aiRecommendation.yieldLabel'),
          data: yields,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.12)',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#7c3aed',
          fill: true,
          yAxisID: 'y',
        },
        {
          label: t('aiRecommendation.annualDiv'),
          data: dividends,
          borderColor: '#06b6d4',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#06b6d4',
          borderDash: [4, 4],
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { color: labelColor, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const n = ctx.raw as number
              if (ctx.datasetIndex === 0) return ` ${t('aiRecommendation.yieldLabel')}: ${n.toFixed(2)}%`
              return ` ${t('aiRecommendation.annualDiv')}: ${formatPrice(n, company.value!.currency)}`
            },
          },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: labelColor } },
        y: {
          position: 'left',
          grid: { color: gridColor },
          ticks: { color: labelColor, callback: (v) => formatPercentTick(v) },
        },
        y1: {
          position: 'right',
          grid: { display: false },
          ticks: {
            color: labelColor,
            callback: (v) =>
              formatPrice(Math.round(Number(v) * 100) / 100, company.value!.currency),
          },
        },
      },
    },
  })
}

watch(
  () => company.value?.historicYields,
  (hy) => {
    if (hy) nextTick(() => buildEvolutionChart())
  },
  { immediate: true },
)

watch(() => themeStore.isDark, () => {
  if (company.value?.historicYields) buildEvolutionChart()
})
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">

    <!-- Back -->
    <button
      class="mb-6 flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400"
      @click="router.push('/ai-recommendation')"
    >
      <FontAwesomeIcon icon="arrow-left" />
      {{ t('aiRecommendation.backToPicks') }}
    </button>

    <!-- Loading -->
    <div v-if="store.isLoading && !company" class="animate-pulse space-y-6">
      <div class="space-y-2">
        <div class="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
        <div class="h-10 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
        <div class="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
      <div class="h-64 rounded-2xl bg-gray-200 dark:bg-gray-800" />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <!-- Not found -->
    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
        <FontAwesomeIcon icon="magnifying-glass" class="text-2xl text-gray-400" />
      </div>
      <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
        {{ t('aiRecommendation.companyNotFound') }}
      </p>
    </div>

    <!-- Detail -->
    <template v-else-if="company">
      <!-- Header band -->
      <div class="mb-8 flex flex-wrap items-start gap-4">
        <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
          <img
            :src="company.logoUrl || `https://logo.clearbit.com/${company.website}`"
            :alt="company.company"
            class="h-full w-full object-contain"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-violet-600 dark:text-violet-400">
            <span>{{ t('aiRecommendation.rankNumber', { rank: company.rank }) }}</span>
            <span
              class="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="[statusConfig[company.status].bg, statusConfig[company.status].text]"
            >
              <FontAwesomeIcon :icon="statusConfig[company.status].icon" class="text-[9px]" />
              {{ t(statusConfig[company.status].label) }}
            </span>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white" :style="{ fontFamily: SERIF }">
            {{ company.company }}
          </h1>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span class="font-mono font-semibold text-violet-600 dark:text-violet-400">{{ company.ticker }}</span>
            <span>·</span>
            <span>{{ countryFlag(company.countryCode) }} {{ company.country }}</span>
            <span>·</span>
            <span>{{ company.sector }}</span>
            <span>·</span>
            <span>{{ company.exchange }}</span>
          </div>
        </div>
        <FollowButton
          :ticker="company.ticker"
          :company="company.company"
          :country="company.country"
          :country-code="company.countryCode"
          :sector="company.sector"
          :exchange="company.exchange"
          source="ai-pick"
        />
      </div>

      <!-- Key metrics -->
      <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800/40 dark:bg-violet-900/20">
          <p class="text-xs text-violet-500 dark:text-violet-400">{{ t('aiRecommendation.yieldLabel') }}</p>
          <p class="mt-1 text-3xl font-bold text-violet-700 dark:text-violet-300">
            {{ company.dividendYield.toFixed(2) }}%
          </p>
          <p class="mt-0.5 text-xs text-violet-400 dark:text-violet-500">
            {{ formatPrice(company.annualDividend, company.currency) }}/yr
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.price') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
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
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.annualDiv') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {{ formatPrice(company.annualDividend, company.currency) }}
          </p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.perShareYear') }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('aiRecommendation.marketCap') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ formatMarketCap(company.marketCap) }}</p>
        </div>
      </div>

      <!-- Yield evolution line chart (phase-2 data) -->
      <div class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('aiRecommendation.evolutionTitle') }}
          </h2>
          <span class="text-[11px] uppercase tracking-widest text-gray-400">
            {{ t('aiRecommendation.yieldHistory') }}
          </span>
        </div>
        <div v-if="company.historicYields === null" class="flex h-64 animate-pulse items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
          <span class="text-xs text-gray-400">{{ t('aiRecommendation.loadingHistory') }}</span>
        </div>
        <div v-else class="h-64">
          <canvas ref="evolutionCanvas" />
        </div>
      </div>

      <!-- Yield bar chart + dividends per year -->
      <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/40">
          <p class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('aiRecommendation.yieldHistory') }}
          </p>
          <div v-if="company.historicYields === null" class="flex h-36 animate-pulse items-end gap-3">
            <div v-for="k in 5" :key="k" class="flex-1 rounded-t-sm bg-gray-200 dark:bg-gray-700" :style="{ height: `${40 + k * 14}px` }" />
          </div>
          <div v-else class="flex h-36 items-end gap-3">
            <div
              v-for="h in company.historicYields"
              :key="h.year"
              class="flex flex-1 flex-col items-center gap-1.5"
            >
              <span class="text-xs font-semibold text-violet-600 dark:text-violet-400">{{ h.yield.toFixed(1) }}%</span>
              <div
                class="w-full rounded-t-md bg-violet-500 transition-all dark:bg-violet-400"
                :style="{ height: barHeightPx(h, company.historicYields, 100) }"
              />
              <span class="text-xs text-gray-400">{{ h.year }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/40">
          <p class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('aiRecommendation.dividendsPerYear') }}
          </p>
          <div v-if="company.dividendsPerYear === null" class="animate-pulse space-y-2.5">
            <div v-for="k in 5" :key="k" class="flex justify-between">
              <div class="h-4 w-10 rounded bg-gray-200 dark:bg-gray-700" />
              <div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="d in [...company.dividendsPerYear].reverse()"
              :key="d.year"
              class="flex items-center justify-between border-b border-gray-200 py-1.5 text-sm last:border-b-0 dark:border-gray-700"
            >
              <span class="font-medium text-gray-600 dark:text-gray-300">{{ d.year }}</span>
              <div class="flex items-center gap-3">
                <span class="font-bold text-gray-900 dark:text-white">
                  {{ formatPrice(d.totalAmount, company.currency) }}
                </span>
                <span class="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                  {{ d.payments }}x
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pro / Con -->
      <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <div class="mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon="thumbs-up" class="text-base text-emerald-600 dark:text-emerald-400" />
            <span class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{{ t('aiRecommendation.proTitle') }}</span>
          </div>
          <p class="text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">{{ localized(company.pro) }}</p>
        </div>
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800/40 dark:bg-red-900/20">
          <div class="mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon="thumbs-down" class="text-base text-red-500 dark:text-red-400" />
            <span class="text-sm font-semibold text-red-700 dark:text-red-300">{{ t('aiRecommendation.conTitle') }}</span>
          </div>
          <p class="text-sm leading-relaxed text-red-800 dark:text-red-200">{{ localized(company.con) }}</p>
        </div>
      </div>

    </template>
  </div>
</template>
