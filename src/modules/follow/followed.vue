<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFollowStore } from './store/follow.store'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useMonthlyDyStore } from '@/modules/monthly-dy/store/monthly-dy.store'
import { useAiRecommendationStore } from '@/modules/ai-recommendation/store/ai-recommendation.store'
import { useDividendsStore } from '@/modules/dividends/store/dividends.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import { useUserProfileStore } from '@/modules/auth/store/user-profile.store'
import { getLogoUrl } from '@/services/logoManifest'
import type { FollowedCompany, FollowSource } from './domain/follow.types'

const { t, d, locale } = useI18n()
const follow = useFollowStore()
const auth = useAuthStore()
const monthlyDy = useMonthlyDyStore()
const aiRec = useAiRecommendationStore()
const dividends = useDividendsStore()
const inflation = useInflationStore()
const profile = useUserProfileStore()

onMounted(() => {
  monthlyDy.init()
  aiRec.init()
  dividends.init()
  inflation.init()
})

// ── Hydration: normalize each followed entry against live source stores ────
type RiskTier = 'low' | 'medium' | 'high'

interface NormalizedView {
  ticker: string
  company: string
  country: string
  countryCode: string
  sector: string
  exchange: string
  source: FollowSource
  followedAt: string
  currency: string | null
  currentPrice: number | null
  priceChangePercent: number | null
  dividendYield: number | null
  annualDividend: number | null
  nextExDividendDate: string | null
  riskTier: RiskTier | null
  hasLiveData: boolean
}

function normalize(entry: FollowedCompany): NormalizedView {
  const base = {
    ticker: entry.ticker,
    company: entry.company,
    country: entry.country,
    countryCode: entry.countryCode,
    sector: entry.sector,
    exchange: entry.exchange,
    source: entry.source,
    followedAt: entry.followedAt,
  }

  // Monthly-DY first — richest data including next ex-div, risk tier
  const cf = monthlyDy.picks.find((p) => p.ticker === entry.ticker)
  if (cf) {
    return {
      ...base,
      currency: cf.currency,
      currentPrice: cf.currentPrice,
      priceChangePercent: cf.priceChangePercent,
      dividendYield: cf.dividendYield,
      annualDividend: cf.annualDividend,
      nextExDividendDate: cf.nextExDividendDate,
      riskTier: cf.riskTier,
      hasLiveData: true,
    }
  }

  const ai = aiRec.cards.find((c) => c.ticker === entry.ticker)
  if (ai) {
    return {
      ...base,
      currency: ai.currency,
      currentPrice: ai.currentPrice,
      priceChangePercent: ai.priceChangePercent,
      dividendYield: ai.dividendYield,
      annualDividend: ai.annualDividend,
      nextExDividendDate: null,
      riskTier: null,
      hasLiveData: true,
    }
  }

  const dv = dividends.stocks.find((s) => s.ticker === entry.ticker)
  if (dv) {
    return {
      ...base,
      currency: dv.currency,
      currentPrice: null,
      priceChangePercent: null,
      dividendYield: dv.dividendYield,
      annualDividend: null,
      nextExDividendDate: null,
      riskTier: null,
      hasLiveData: true,
    }
  }

  return {
    ...base,
    currency: null,
    currentPrice: null,
    priceChangePercent: null,
    dividendYield: null,
    annualDividend: null,
    nextExDividendDate: null,
    riskTier: null,
    hasLiveData: false,
  }
}

const normalizedAll = computed<NormalizedView[]>(() =>
  follow.list.map(normalize),
)

// ── Filter chips ──────────────────────────────────────────────────────────
type FilterValue = 'all' | FollowSource
const activeFilter = ref<FilterValue>('all')

const counts = computed(() => {
  const c = { all: normalizedAll.value.length, 'ai-pick': 0, dividend: 0, 'monthly-dy': 0 }
  for (const v of normalizedAll.value) c[v.source] += 1
  return c
})

const filtered = computed(() =>
  activeFilter.value === 'all'
    ? normalizedAll.value
    : normalizedAll.value.filter((v) => v.source === activeFilter.value),
)

const filterChips: { value: FilterValue; labelKey: string }[] = [
  { value: 'all', labelKey: 'follow.filterAll' },
  { value: 'ai-pick', labelKey: 'follow.sourceAi' },
  { value: 'dividend', labelKey: 'follow.sourceDividend' },
  { value: 'monthly-dy', labelKey: 'follow.sourceMonthlyDy' },
]

// ── Source pill styling ───────────────────────────────────────────────────
const sourcePill: Record<FollowSource, { label: string; classes: string }> = {
  'ai-pick': {
    label: 'follow.sourceAi',
    classes: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/40 dark:bg-violet-900/30 dark:text-violet-300',
  },
  'dividend': {
    label: 'follow.sourceDividend',
    classes: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/30 dark:text-blue-300',
  },
  'monthly-dy': {
    label: 'follow.sourceMonthlyDy',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
}

// ── Risk tier styling (monthly-dy only) ───────────────────────────────────
const riskConfig: Record<RiskTier, { label: string; classes: string; icon: string }> = {
  low: {
    label: 'monthlyDy.riskLow',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'shield-halved',
  },
  medium: {
    label: 'monthlyDy.riskMedium',
    classes: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'shield-halved',
  },
  high: {
    label: 'monthlyDy.riskHigh',
    classes: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-300',
    icon: 'triangle-exclamation',
  },
}

// ── Inflation badge (per pick, when user has tax country) ─────────────────
type Verdict = 'beats' | 'matches' | 'loses'

const userInflation = computed(() => {
  const code = profile.taxCountryCode
  if (!code) return null
  return inflation.countries.find((c) => c.countryCode === code) ?? null
})

const showInflation = computed(
  () => auth.isAuthenticated && profile.hasTaxCountry && userInflation.value !== null,
)

function inflationVerdict(viewYield: number | null): { verdict: Verdict; amount: number } | null {
  if (!showInflation.value || viewYield === null || !userInflation.value) return null
  const diff = +(viewYield - userInflation.value.rate).toFixed(1)
  return {
    verdict: diff > 0 ? 'beats' : diff < 0 ? 'loses' : 'matches',
    amount: Math.abs(diff),
  }
}

const verdictPalette: Record<Verdict, { classes: string; icon: string }> = {
  beats: {
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'arrow-trend-up',
  },
  matches: {
    classes: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'minus',
  },
  loses: {
    classes: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-300',
    icon: 'arrow-trend-down',
  },
}

// ── Formatters ─────────────────────────────────────────────────────────────
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

function formatPrice(amount: number, currency: string | null): string {
  if (!currency) return amount.toFixed(2)
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFollowedDate(iso: string): string {
  try {
    return d(new Date(iso), 'short')
  } catch {
    return iso.split('T')[0]
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso + 'T00:00:00Z').getTime()
  if (Number.isNaN(target)) return null
  return Math.round((target - Date.now()) / (1000 * 60 * 60 * 24))
}

// ── Unfollow ───────────────────────────────────────────────────────────────
async function removeEntry(ticker: string, event: Event) {
  event.stopPropagation()
  try {
    await follow.unfollow(ticker)
  } catch {
    // surfaced via follow.error
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 pt-20 pb-10 lg:px-8 lg:pt-10">
    <header class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('follow.listTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('follow.listSubtitle') }}</p>
    </header>

    <!-- Not logged in -->
    <div
      v-if="!auth.isAuthenticated"
      class="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900"
    >
      <FontAwesomeIcon icon="right-to-bracket" class="mb-3 text-2xl text-violet-500" />
      <p class="mb-4 text-gray-600 dark:text-gray-300">{{ t('follow.loginRequired') }}</p>
      <RouterLink
        to="/login"
        class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
      >
        {{ t('auth.menu.login') }}
      </RouterLink>
    </div>

    <!-- Logged in, loading -->
    <div
      v-else-if="!follow.isReady || follow.isLoading"
      class="text-center text-gray-500 dark:text-gray-400"
    >
      {{ t('follow.loading') }}
    </div>

    <!-- Logged in, empty -->
    <div
      v-else-if="follow.count === 0"
      class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <FontAwesomeIcon icon="star" class="mb-3 text-3xl text-amber-400" />
      <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('follow.emptyTitle') }}</p>
      <p class="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('follow.emptyBody') }}</p>
      <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
        <RouterLink
          to="/ai-recommendation"
          class="cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {{ t('nav.aiRecommendation') }}
        </RouterLink>
        <RouterLink
          to="/dividends"
          class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {{ t('nav.dividends') }}
        </RouterLink>
        <RouterLink
          to="/monthly-dy"
          class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {{ t('nav.monthlyDy') }}
        </RouterLink>
      </div>
    </div>

    <!-- Logged in, filled -->
    <template v-else>
      <!-- Filter chips -->
      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="chip in filterChips"
          :key="chip.value"
          type="button"
          class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
          :class="
            activeFilter === chip.value
              ? 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
          "
          @click="activeFilter = chip.value"
        >
          {{ t(chip.labelKey) }}
          <span class="ml-1 text-[10px] opacity-70">{{ counts[chip.value] }}</span>
        </button>
      </div>

      <!-- Cards -->
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="v in filtered"
          :key="v.ticker"
          class="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <!-- Top row: logo · company · source pill · unfollow -->
          <div class="flex items-start gap-3">
            <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800">
              <img
                v-if="getLogoUrl(v.ticker)"
                :src="getLogoUrl(v.ticker)!"
                :alt="v.company"
                class="h-full w-full object-contain"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <FontAwesomeIcon v-else icon="building" class="text-base text-gray-300" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="truncate text-base font-bold text-gray-900 dark:text-white">{{ v.company }}</h3>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <span class="font-mono font-semibold text-gray-700 dark:text-gray-300">{{ v.ticker }}</span>
                <span v-if="v.countryCode">·</span>
                <span v-if="v.countryCode">{{ countryFlag(v.countryCode) }} {{ v.country }}</span>
                <span v-if="v.sector">·</span>
                <span v-if="v.sector" class="truncate">{{ v.sector }}</span>
                <span v-if="v.exchange">·</span>
                <span v-if="v.exchange">{{ v.exchange }}</span>
              </div>
            </div>

            <span
              class="flex-shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              :class="sourcePill[v.source].classes"
            >
              {{ t(sourcePill[v.source].label) }}
            </span>

            <button
              type="button"
              :aria-label="t('follow.unfollow')"
              class="flex-shrink-0 cursor-pointer rounded-lg p-2 text-amber-500 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
              @click="removeEntry(v.ticker, $event)"
            >
              <FontAwesomeIcon icon="star" />
            </button>
          </div>

          <!-- Hero metric: yield -->
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              <template v-if="v.dividendYield !== null">{{ v.dividendYield.toFixed(2) }}%</template>
              <template v-else>—</template>
            </span>
            <span class="text-xs text-gray-400">{{ t('monthlyDy.yieldLabel') }}</span>
          </div>

          <!-- Sub-metrics 3-col grid -->
          <div class="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('monthlyDy.price') }}</p>
              <p class="mt-0.5 font-semibold text-gray-900 dark:text-white">
                <template v-if="v.currentPrice !== null">{{ formatPrice(v.currentPrice, v.currency) }}</template>
                <template v-else>—</template>
              </p>
              <p
                v-if="v.priceChangePercent !== null"
                class="mt-0.5 flex items-center gap-1 text-[11px]"
                :class="v.priceChangePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
              >
                <FontAwesomeIcon :icon="v.priceChangePercent >= 0 ? 'arrow-up' : 'arrow-down'" class="text-[8px]" />
                {{ Math.abs(v.priceChangePercent).toFixed(2) }}%
              </p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('monthlyDy.annualDividend') }}</p>
              <p class="mt-0.5 font-semibold text-gray-900 dark:text-white">
                <template v-if="v.annualDividend !== null">{{ formatPrice(v.annualDividend, v.currency) }}</template>
                <template v-else>—</template>
              </p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ t('follow.nextExDiv') }}</p>
              <p class="mt-0.5 font-semibold text-gray-900 dark:text-white">
                <template v-if="v.nextExDividendDate">{{ formatLongDate(v.nextExDividendDate) }}</template>
                <template v-else>—</template>
              </p>
              <p
                v-if="v.nextExDividendDate && daysUntil(v.nextExDividendDate) !== null && daysUntil(v.nextExDividendDate)! >= 0 && daysUntil(v.nextExDividendDate)! <= 30"
                class="mt-0.5 text-[11px] font-semibold"
                :class="daysUntil(v.nextExDividendDate)! <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'"
              >
                <template v-if="daysUntil(v.nextExDividendDate) === 0">{{ t('monthlyDy.nextExDividendToday') }}</template>
                <template v-else>{{ t('monthlyDy.nextExDividendIn', { days: daysUntil(v.nextExDividendDate) }) }}</template>
              </p>
            </div>
          </div>

          <!-- Footer chips: inflation badge + risk badge -->
          <div
            v-if="inflationVerdict(v.dividendYield) || v.riskTier"
            class="mt-4 flex flex-wrap items-center gap-2"
          >
            <span
              v-if="inflationVerdict(v.dividendYield) as ReturnType<typeof inflationVerdict>"
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              :class="verdictPalette[inflationVerdict(v.dividendYield)!.verdict].classes"
            >
              <FontAwesomeIcon :icon="verdictPalette[inflationVerdict(v.dividendYield)!.verdict].icon" class="text-[9px]" />
              <template v-if="inflationVerdict(v.dividendYield)!.verdict === 'beats'">
                {{ t('follow.beatsInflation', { amount: inflationVerdict(v.dividendYield)!.amount.toFixed(1) }) }}
              </template>
              <template v-else-if="inflationVerdict(v.dividendYield)!.verdict === 'loses'">
                {{ t('follow.losesInflation', { amount: inflationVerdict(v.dividendYield)!.amount.toFixed(1) }) }}
              </template>
              <template v-else>{{ t('follow.matchesInflation') }}</template>
            </span>
            <span
              v-if="v.riskTier"
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              :class="riskConfig[v.riskTier].classes"
            >
              <FontAwesomeIcon :icon="riskConfig[v.riskTier].icon" class="text-[9px]" />
              {{ t('monthlyDy.riskTitle') }}: {{ t(riskConfig[v.riskTier].label) }}
            </span>
          </div>

          <!-- Footer: live data hint + followed date -->
          <div class="mt-auto pt-4 flex items-center justify-between gap-2 text-[11px] text-gray-400 dark:text-gray-500">
            <span v-if="!v.hasLiveData" class="inline-flex items-center gap-1 italic">
              <FontAwesomeIcon icon="magnifying-glass" class="text-[9px]" />
              {{ t('follow.liveDataRefreshing') }}
            </span>
            <span v-else></span>
            <span>{{ t('follow.followedOn', { date: formatFollowedDate(v.followedAt) }) }}</span>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
