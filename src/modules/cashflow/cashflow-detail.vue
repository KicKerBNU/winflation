<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Chart, registerables } from 'chart.js'
import { useCashflowStore } from './store/cashflow.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useUserProfileStore } from '@/modules/auth/store/user-profile.store'
import { useThemeStore } from '@/modules/theme/store/theme.store'
import { getWhtForPair } from '@/modules/settings/domain/withholding-rates'
import { getLogoUrl } from '@/services/logoManifest'
import FollowButton from '@/modules/follow/components/FollowButton.vue'
import type { CashflowPick, RiskTier, AssetClass } from './domain/cashflow.types'

Chart.register(...registerables)

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useCashflowStore()
const inflationStore = useInflationStore()
const authStore = useAuthStore()
const profileStore = useUserProfileStore()
const themeStore = useThemeStore()

const ticker = computed(() => decodeURIComponent(route.params.ticker as string))
const pick = computed<CashflowPick | null>(
  () => store.picks.find((p) => p.ticker === ticker.value) ?? null,
)
const notFound = computed(() => !store.isLoading && store.hasData && !pick.value)

onMounted(() => {
  store.init()
  inflationStore.init()
})

function countryFlag(code: string | null): string {
  if (!code) return ''
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))).join('')
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

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso + 'T00:00:00Z').getTime()
  if (Number.isNaN(t)) return null
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24))
}

const riskConfig: Record<RiskTier, { label: string; desc: string; pill: string; iconColor: string; icon: string }> = {
  low: {
    label: 'cashflow.riskLow',
    desc: 'cashflow.riskLowDesc',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    icon: 'shield-halved',
  },
  medium: {
    label: 'cashflow.riskMedium',
    desc: 'cashflow.riskMediumDesc',
    pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300',
    iconColor: 'text-amber-500 dark:text-amber-400',
    icon: 'shield-halved',
  },
  high: {
    label: 'cashflow.riskHigh',
    desc: 'cashflow.riskHighDesc',
    pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-300',
    iconColor: 'text-red-500 dark:text-red-400',
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

// ── Inflation badge (reuse user's tax country HICP) ────────────────────────
type BeatVerdict = 'beats' | 'matches' | 'loses'

const userInflation = computed(() => {
  const code = profileStore.taxCountryCode
  if (!code) return null
  return inflationStore.countries.find((c) => c.countryCode === code) ?? null
})

const showInflationBlock = computed(
  () => authStore.isAuthenticated && profileStore.hasTaxCountry && userInflation.value !== null,
)

const inflationBeat = computed(() => {
  if (!pick.value || !userInflation.value) return null
  const diff = +(pick.value.dividendYield - userInflation.value.rate).toFixed(1)
  const verdict: BeatVerdict = diff > 0 ? 'beats' : diff < 0 ? 'loses' : 'matches'
  return {
    verdict,
    amount: Math.abs(diff),
    nominal: pick.value.dividendYield,
    inflation: userInflation.value.rate,
    countryName: userInflation.value.country,
    asOf: userInflation.value.date,
  }
})

const beatPalette: Record<BeatVerdict, { card: string; iconColor: string; icon: string; valueColor: string }> = {
  beats: {
    card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: 'arrow-trend-up',
    valueColor: 'text-emerald-700 dark:text-emerald-300',
  },
  matches: {
    card: 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    icon: 'minus',
    valueColor: 'text-amber-700 dark:text-amber-300',
  },
  loses: {
    card: 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20',
    iconColor: 'text-red-600 dark:text-red-400',
    icon: 'arrow-trend-down',
    valueColor: 'text-red-700 dark:text-red-300',
  },
}

function beatLongText(b: NonNullable<typeof inflationBeat.value>): string {
  if (b.verdict === 'beats') return t('aiRecommendation.inflationBeatBeats', { amount: b.amount.toFixed(1) })
  if (b.verdict === 'loses') return t('aiRecommendation.inflationBeatLoses', { amount: b.amount.toFixed(1) })
  return t('aiRecommendation.inflationBeatMatches')
}

// ── WHT for the pick's source country, given user's tax country ────────────
const wht = computed(() => {
  if (!pick.value?.countryCode || !profileStore.taxCountryCode) return null
  return getWhtForPair(pick.value.countryCode, profileStore.taxCountryCode)
})

function fmtPct(rate: number): string {
  return `${parseFloat((rate * 100).toFixed(3))}%`
}

// ── Distributions list (grouped by year, newest first) ───────────────────
interface DistributionYearGroup {
  year: number
  total: number
  rows: { date: string; amount: number }[]
}

const distributionsByYear = computed<DistributionYearGroup[]>(() => {
  if (!pick.value) return []
  const groups = new Map<number, DistributionYearGroup>()
  for (const d of pick.value.recentDistributions) {
    const y = Number(d.date.slice(0, 4))
    if (!groups.has(y)) groups.set(y, { year: y, total: 0, rows: [] })
    const g = groups.get(y)!
    g.total += d.amount
    g.rows.push(d)
  }
  for (const g of groups.values()) g.rows.sort((a, b) => b.date.localeCompare(a.date))
  return [...groups.values()].sort((a, b) => b.year - a.year)
})

// Largest single distribution across the full 5y window — scales bar widths
const maxDist = computed(() => {
  const xs = pick.value?.recentDistributions.map((d) => d.amount) ?? []
  return Math.max(...xs, 0.01)
})

function barWidthPct(amount: number): string {
  return `${Math.max((amount / maxDist.value) * 100, 8)}%`
}

// ── 5y price-history chart with dividend "D" markers ─────────────────────
const priceCanvas = ref<HTMLCanvasElement | null>(null)
let priceChart: Chart | null = null

const hasPriceHistory = computed(() => (pick.value?.priceHistory?.length ?? 0) > 0)

const priceHistorySinceLabel = computed(() => {
  const first = pick.value?.priceHistory?.[0]?.date
  if (!first) return null
  return new Date(first + 'T00:00:00Z').toLocaleDateString(locale.value, { month: 'short', year: 'numeric' })
})

// Custom point style: filled circle with a "D" letter inside. Built once per
// theme; scaled by Chart.js when drawn. Cached so we don't rebuild per point.
function buildDividendMarker(isDark: boolean): HTMLCanvasElement {
  const size = 13
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const cv = document.createElement('canvas')
  cv.width = size * dpr
  cv.height = size * dpr
  const ctx = cv.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2)
  ctx.fillStyle = '#10b981'
  ctx.fill()
  ctx.strokeStyle = isDark ? '#064e3b' : '#ffffff'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 8px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('D', size / 2, size / 2 + 0.5)
  return cv
}

function buildPriceChart() {
  if (!priceCanvas.value || !pick.value) return
  priceChart?.destroy()
  const history = pick.value.priceHistory
  if (!history || history.length === 0) return

  const isDark = themeStore.isDark
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const labelColor = isDark ? '#9ca3af' : '#6b7280'
  const lineColor = '#10b981'
  const fillColor = isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.14)'

  const isoFromTs = (ts: number) => new Date(ts).toISOString().slice(0, 10)
  const linePoints = history.map((p) => ({ x: new Date(p.date).getTime(), y: p.close }))

  // Snap each dividend to the closest monthly close so the marker sits on the line
  const closes = history.map((h) => ({ t: new Date(h.date).getTime(), close: h.close }))
  const dividendPoints = pick.value.recentDistributions.map((d) => {
    const t = new Date(d.date).getTime()
    let nearest = closes[0]
    let best = Math.abs(t - nearest.t)
    for (const c of closes) {
      const diff = Math.abs(t - c.t)
      if (diff < best) { best = diff; nearest = c }
    }
    return { x: nearest.t, y: nearest.close, _amount: d.amount, _exDate: d.date }
  })

  const marker = buildDividendMarker(isDark)
  const currency = pick.value.currency

  priceChart = new Chart(priceCanvas.value, {
    type: 'line',
    data: {
      datasets: [
        {
          label: t('cashflow.priceLabel'),
          data: linePoints,
          parsing: false,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          tension: 0.25,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 2,
        },
        {
          label: t('cashflow.dividendMarkerLabel'),
          data: dividendPoints as unknown as { x: number; y: number }[],
          parsing: false,
          showLine: false,
          pointStyle: marker,
          pointRadius: 6.5,
          pointHoverRadius: 8,
          borderWidth: 0,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const it = items[0]
              if (!it) return ''
              const raw = it.raw as { x: number; _exDate?: string }
              const iso = raw._exDate ?? isoFromTs(raw.x)
              return new Date(iso + 'T00:00:00Z').toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
            },
            label: (ctx) => {
              const raw = ctx.raw as { x: number; y: number; _amount?: number }
              if (ctx.datasetIndex === 1 && raw._amount !== undefined) {
                return [
                  ` ${t('cashflow.dividendTooltipAmount', { amount: formatPrice(raw._amount, currency) })}`,
                  ` ${t('cashflow.priceLabel')}: ${formatPrice(raw.y, currency)}`,
                ]
              }
              return ` ${t('cashflow.priceLabel')}: ${formatPrice(raw.y, currency)}`
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          grid: { color: gridColor },
          ticks: {
            color: labelColor,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            callback: (v) => new Date(Number(v)).getUTCFullYear().toString(),
          },
        },
        y: {
          position: 'right',
          grid: { color: gridColor },
          ticks: {
            color: labelColor,
            callback: (v) => formatPrice(Number(v), currency),
          },
        },
      },
    },
  })
}

watch(
  () => pick.value?.priceHistory,
  (h) => {
    if (h && h.length > 0) nextTick(() => buildPriceChart())
  },
  { immediate: true },
)

watch(() => themeStore.isDark, () => {
  if (pick.value?.priceHistory?.length) buildPriceChart()
})

onBeforeUnmount(() => {
  priceChart?.destroy()
  priceChart = null
})
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <button
      class="mb-6 flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400"
      @click="router.push('/cashflow')"
    >
      <FontAwesomeIcon icon="arrow-left" />
      {{ t('cashflow.backToList') }}
    </button>

    <div v-if="store.isLoading && !pick" class="space-y-4">
      <div class="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>

    <div
      v-else-if="store.error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <div
      v-else-if="notFound"
      class="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <FontAwesomeIcon icon="magnifying-glass" class="mb-3 text-2xl text-gray-300" />
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('cashflow.notFound') }}</p>
    </div>

    <template v-else-if="pick">
      <!-- Header -->
      <div class="mb-6 flex flex-wrap items-start gap-4">
        <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
          <img
            v-if="getLogoUrl(pick.ticker)"
            :src="getLogoUrl(pick.ticker)!"
            :alt="pick.company"
            class="h-full w-full object-contain"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <FontAwesomeIcon v-else icon="building" class="text-xl text-gray-300" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold normal-case tracking-normal"
              :class="riskConfig[pick.riskTier].pill"
            >
              <FontAwesomeIcon :icon="riskConfig[pick.riskTier].icon" class="text-[9px]" />
              {{ t('cashflow.riskTitle') }}: {{ t(riskConfig[pick.riskTier].label) }}
            </span>
            <span class="text-gray-400">·</span>
            <span>{{ t(assetClassLabel[pick.assetClass]) }}</span>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
            {{ pick.company }}
          </h1>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span class="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{{ pick.ticker }}</span>
            <template v-if="pick.countryCode">
              <span>·</span>
              <span>{{ countryFlag(pick.countryCode) }} {{ pick.country }}</span>
            </template>
            <template v-if="pick.sector">
              <span>·</span>
              <span>{{ pick.sector }}</span>
            </template>
            <template v-if="pick.exchange">
              <span>·</span>
              <span>{{ pick.exchange }}</span>
            </template>
          </div>
        </div>

        <FollowButton
          :ticker="pick.ticker"
          :company="pick.company"
          :country="pick.country ?? ''"
          :country-code="pick.countryCode ?? ''"
          :sector="pick.sector ?? ''"
          :exchange="pick.exchange ?? ''"
          source="ai-pick"
        />
      </div>

      <!-- 5y price history with dividend markers -->
      <div
        v-if="hasPriceHistory"
        class="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('cashflow.priceHistoryTitle') }}
          </h2>
          <span v-if="priceHistorySinceLabel" class="text-[11px] text-gray-400">
            {{ t('cashflow.priceHistorySince', { date: priceHistorySinceLabel }) }}
          </span>
        </div>
        <div class="relative h-64 sm:h-72">
          <canvas ref="priceCanvas" />
        </div>
      </div>

      <!-- Inflation-beat block (logged in + tax country set) -->
      <div
        v-if="showInflationBlock && inflationBeat"
        class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm"
        :class="beatPalette[inflationBeat.verdict].card"
      >
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-black/30">
          <FontAwesomeIcon
            :icon="beatPalette[inflationBeat.verdict].icon"
            :class="beatPalette[inflationBeat.verdict].iconColor"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold uppercase tracking-widest" :class="beatPalette[inflationBeat.verdict].iconColor">
            {{ t('aiRecommendation.inflationBeatTitle') }}
          </p>
          <p class="mt-0.5 text-base font-bold leading-tight" :class="beatPalette[inflationBeat.verdict].valueColor">
            {{ beatLongText(inflationBeat) }}
          </p>
          <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {{ t('aiRecommendation.inflationBeatHint', {
                nominal: inflationBeat.nominal.toFixed(2),
                inflation: inflationBeat.inflation.toFixed(2),
                country: inflationBeat.countryName,
              })
            }}
            · {{ t('aiRecommendation.hicpAsOf', { date: inflationBeat.asOf }) }}
          </p>
        </div>
      </div>

      <!-- Risk explainer -->
      <div
        class="mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm"
        :class="riskConfig[pick.riskTier].pill"
      >
        <FontAwesomeIcon :icon="riskConfig[pick.riskTier].icon" :class="['mt-0.5 flex-shrink-0', riskConfig[pick.riskTier].iconColor]" />
        <p class="leading-relaxed">{{ t(riskConfig[pick.riskTier].desc) }}</p>
      </div>

      <!-- Key metrics -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <p class="text-xs text-emerald-600 dark:text-emerald-400">{{ t('cashflow.yieldLabel') }}</p>
          <p class="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
            {{ pick.dividendYield.toFixed(2) }}%
          </p>
          <p class="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-400/80">
            {{ t('cashflow.paymentsPerYear', { n: pick.paymentFrequency }) }}
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400">{{ t('cashflow.annualDividend') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {{ formatPrice(pick.annualDividend, pick.currency) }}
          </p>
          <p class="mt-0.5 text-xs text-gray-400">
            {{ t('cashflow.perPaymentLabel') }}: {{ formatPrice(pick.annualDividend / Math.max(pick.paymentFrequency, 1), pick.currency) }}
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400">{{ t('cashflow.price') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {{ formatPrice(pick.currentPrice, pick.currency) }}
          </p>
          <p
            class="mt-0.5 flex items-center gap-1 text-xs"
            :class="pick.priceChangePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
          >
            <FontAwesomeIcon :icon="pick.priceChangePercent >= 0 ? 'arrow-up' : 'arrow-down'" class="text-[9px]" />
            {{ Math.abs(pick.priceChangePercent).toFixed(2) }}%
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-xs text-gray-400">{{ t('cashflow.marketCap') }}</p>
          <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {{ formatMarketCap(pick.marketCap, pick.currency) }}
          </p>
        </div>
      </div>

      <!-- Calendar block: next ex-div + next pay + last paid -->
      <div class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('cashflow.nextExDividendOn', { date: '' }) }}</p>
          <p class="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            <template v-if="pick.nextExDividendDate">{{ formatLongDate(pick.nextExDividendDate) }}</template>
            <template v-else>—</template>
          </p>
          <p
            v-if="daysUntil(pick.nextExDividendDate) !== null"
            class="mt-0.5 text-xs"
            :class="daysUntil(pick.nextExDividendDate)! <= 14 && daysUntil(pick.nextExDividendDate)! >= 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-400'"
          >
            <template v-if="daysUntil(pick.nextExDividendDate)! === 0">{{ t('cashflow.nextExDividendToday') }}</template>
            <template v-else-if="daysUntil(pick.nextExDividendDate)! > 0">
              {{ t('cashflow.nextExDividendIn', { days: daysUntil(pick.nextExDividendDate) }) }}
            </template>
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('cashflow.nextPaymentOn', { date: '' }) }}</p>
          <p class="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            <template v-if="pick.nextPaymentDate">{{ formatLongDate(pick.nextPaymentDate) }}</template>
            <template v-else>—</template>
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('cashflow.lastDividendOn', { date: '' }) }}</p>
          <p class="mt-1 text-base font-semibold text-gray-900 dark:text-white">
            <template v-if="pick.lastDividendDate">{{ formatLongDate(pick.lastDividendDate) }}</template>
            <template v-else>—</template>
          </p>
          <p v-if="pick.lastDividendAmount" class="mt-0.5 text-xs text-gray-400">
            {{ formatPrice(pick.lastDividendAmount, pick.currency) }}
          </p>
        </div>
      </div>

      <!-- Distributions (up to trailing 5 years, grouped by year) -->
      <div class="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 class="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('cashflow.distributionsTitle') }}
        </h2>
        <div v-if="distributionsByYear.length === 0" class="text-xs text-gray-400">
          {{ t('cashflow.distributionsEmpty') }}
        </div>
        <div v-else class="space-y-5">
          <section v-for="g in distributionsByYear" :key="g.year">
            <header class="mb-2 flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 dark:border-gray-800">
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ g.year }}</span>
              <span class="text-[11px] text-gray-400">
                {{ t('cashflow.distributionsYearTotal', { total: formatPrice(g.total, pick.currency), count: g.rows.length }) }}
              </span>
            </header>
            <ul class="divide-y divide-gray-100 dark:divide-gray-800">
              <li
                v-for="d in g.rows"
                :key="d.date"
                class="grid grid-cols-[110px_1fr_auto] items-center gap-3 py-2 text-sm"
              >
                <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ formatLongDate(d.date) }}</span>
                <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div class="h-full rounded-full bg-emerald-500/70 dark:bg-emerald-400/70" :style="{ width: barWidthPct(d.amount) }" />
                </div>
                <span class="font-mono text-sm font-bold text-gray-900 tabular-nums dark:text-white">
                  {{ formatPrice(d.amount, pick.currency) }}
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <!-- WHT (if logged in + tax country + we have data for the source country) -->
      <div
        v-if="wht && pick.countryCode"
        class="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('settings.wht.title') }}
        </h2>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('settings.wht.statutory') }}</span>
            <span class="font-mono text-base font-bold text-gray-900 dark:text-white">{{ fmtPct(wht.statutory) }}</span>
          </div>
          <div v-if="wht.treaty !== null" class="flex items-baseline gap-1.5">
            <span class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('settings.wht.treaty') }}</span>
            <span class="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">{{ fmtPct(wht.treaty) }}</span>
          </div>
          <span
            v-if="wht.treaty !== null"
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            :class="
              wht.reclaimAtSource
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300'
            "
          >
            {{ wht.reclaimAtSource ? t('settings.wht.appliedAtSource') : t('settings.wht.requiresReclaim') }}
          </span>
        </div>
        <p v-if="wht.reclaimNote" class="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          {{ wht.reclaimNote }}
        </p>
      </div>

      <!-- Key facts (small ETF expense ratio etc) -->
      <div
        v-if="pick.expenseRatio !== null && pick.expenseRatio !== undefined"
        class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('cashflow.keyFactsTitle') }}
        </h2>
        <div class="flex items-baseline gap-2 text-sm">
          <span class="text-xs text-gray-400">{{ t('cashflow.expenseRatio') }}</span>
          <span class="font-mono font-bold text-gray-900 dark:text-white">{{ fmtPct(pick.expenseRatio!) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
