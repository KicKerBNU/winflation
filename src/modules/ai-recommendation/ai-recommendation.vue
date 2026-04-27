<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiRecommendationStore } from './store/ai-recommendation.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useUserProfileStore } from '@/modules/auth/store/user-profile.store'
import type { AiCompanyCard, YearlyYield, CompanyStatus, LocalizedText, QualityTier } from './domain/ai-recommendation.types'

const { t, locale } = useI18n()
const store = useAiRecommendationStore()
const inflationStore = useInflationStore()
const authStore = useAuthStore()
const profileStore = useUserProfileStore()

store.init()
inflationStore.init()

type BeatVerdict = 'beats' | 'matches' | 'loses'
interface InflationBeat {
  verdict: BeatVerdict
  amount: number          // |nominal − userHICP|, 1-decimal
  nominal: number
  inflation: number
  countryCode: string
  countryName: string
}

const userInflation = computed(() => {
  const code = profileStore.taxCountryCode
  if (!code) return null
  return inflationStore.countries.find((c) => c.countryCode === code) ?? null
})

const showInflationBadge = computed(
  () => authStore.isAuthenticated && profileStore.hasTaxCountry && userInflation.value !== null,
)

const showInflationCta = computed(
  () => authStore.isAuthenticated && !profileStore.hasTaxCountry && profileStore.isLoaded,
)

function inflationBeat(card: AiCompanyCard): InflationBeat | null {
  const infl = userInflation.value
  if (!infl) return null
  const diff = +(card.dividendYield - infl.rate).toFixed(1)
  const verdict: BeatVerdict = diff > 0 ? 'beats' : diff < 0 ? 'loses' : 'matches'
  return {
    verdict,
    amount: Math.abs(diff),
    nominal: card.dividendYield,
    inflation: infl.rate,
    countryCode: infl.countryCode,
    countryName: infl.country,
  }
}

const beatPalette: Record<BeatVerdict, { pill: string; icon: string }> = {
  beats: {
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'arrow-trend-up',
  },
  matches: {
    pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'minus',
  },
  loses: {
    pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-300',
    icon: 'arrow-trend-down',
  },
}

function beatShortText(beat: InflationBeat): string {
  if (beat.verdict === 'beats') return t('aiRecommendation.inflationBeatShort', { amount: beat.amount.toFixed(1) })
  if (beat.verdict === 'loses') return t('aiRecommendation.inflationBeatShortNeg', { amount: beat.amount.toFixed(1) })
  return t('aiRecommendation.inflationBeatShortMatch')
}

function beatTooltip(beat: InflationBeat): string {
  return t('aiRecommendation.inflationBeatHint', {
    nominal: beat.nominal.toFixed(2),
    inflation: beat.inflation.toFixed(2),
    country: beat.countryName,
  })
}

const SERIF = "ui-serif, Georgia, 'Times New Roman', serif"

const formattedDate = computed(() => {
  if (!store.generatedAt) return ''
  return new Date(store.generatedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const hero = computed<AiCompanyCard | null>(() => store.cards[0] ?? null)
const rest = computed<AiCompanyCard[]>(() => store.cards.slice(1))

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

function routeForCompany(ticker: string) {
  return { name: 'ai-recommendation-detail', params: { ticker: encodeURIComponent(ticker) } }
}

const tierConfig: Record<QualityTier, { label: string; short: string; desc: string; pill: string; iconColor: string }> = {
  conservative: {
    label: 'aiRecommendation.tierConservative',
    short: 'aiRecommendation.tierConservativeShort',
    desc: 'aiRecommendation.tierConservativeDesc',
    pill: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/40 dark:bg-sky-900/30 dark:text-sky-300',
    iconColor: 'text-sky-500 dark:text-sky-400',
  },
  moderate: {
    label: 'aiRecommendation.tierModerate',
    short: 'aiRecommendation.tierModerateShort',
    desc: 'aiRecommendation.tierModerateDesc',
    pill: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-900/30 dark:text-indigo-300',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
  },
  permissive: {
    label: 'aiRecommendation.tierPermissive',
    short: 'aiRecommendation.tierPermissiveShort',
    desc: 'aiRecommendation.tierPermissiveDesc',
    pill: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/40 dark:bg-orange-900/30 dark:text-orange-300',
    iconColor: 'text-orange-500 dark:text-orange-400',
  },
}

const statusConfig: Record<CompanyStatus, { label: string; dot: string; text: string; bar: string }> = {
  bullish: {
    label: 'aiRecommendation.statusBullish',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
  },
  neutral: {
    label: 'aiRecommendation.statusNeutral',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500 dark:bg-amber-400',
  },
  bearish: {
    label: 'aiRecommendation.statusBearish',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    bar: 'bg-red-500 dark:bg-red-400',
  },
}
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">

    <!-- Editorial header -->
    <header class="mx-auto mb-12 max-w-4xl text-center">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500"></span>
        <template v-if="formattedDate">{{ t('aiRecommendation.kicker', { date: formattedDate }) }}</template>
        <template v-else>{{ t('aiRecommendation.kickerNoDate') }}</template>
      </div>
      <h1
        class="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-gray-900 sm:text-5xl dark:text-white"
        :style="{ fontFamily: SERIF }"
      >
        {{ t('aiRecommendation.headlinePre') }}
        <em class="italic text-violet-600 dark:text-violet-400">{{ t('aiRecommendation.headlineAccent') }}</em>.
      </h1>
      <p class="mt-4 text-base leading-relaxed text-gray-500 sm:text-lg dark:text-gray-400">
        {{ t('aiRecommendation.editorialSubtitle') }}
      </p>
    </header>

    <!-- Compliance band -->
    <div
      role="note"
      class="mx-auto mb-10 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <div class="flex items-start gap-2.5">
        <FontAwesomeIcon icon="triangle-exclamation" class="mt-0.5 flex-shrink-0" />
        <p class="leading-relaxed">
          <span class="font-semibold">{{ t('aiRecommendation.disclaimer.complianceLead') }}.</span>
          {{ ' ' }}
          <span>{{ t('aiRecommendation.disclaimer.complianceBody') }}</span>
        </p>
      </div>
    </div>

    <!-- Tax-country CTA (logged in, no country set) -->
    <RouterLink
      v-if="showInflationCta"
      to="/settings"
      class="mx-auto mb-10 flex max-w-5xl cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 transition-colors hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200 dark:hover:bg-violet-900/40"
    >
      <FontAwesomeIcon icon="gear" class="mt-0.5 flex-shrink-0" />
      <div class="flex-1">
        <p class="font-semibold">{{ t('aiRecommendation.inflationCtaTitle') }}</p>
        <p class="mt-0.5 text-xs text-violet-700/80 dark:text-violet-300/80">
          {{ t('aiRecommendation.inflationCtaBody') }}
        </p>
      </div>
      <span class="hidden flex-shrink-0 items-center gap-1 self-center text-xs font-semibold uppercase tracking-wider sm:inline-flex">
        {{ t('aiRecommendation.inflationCtaLink') }}
        <FontAwesomeIcon icon="arrow-right" class="text-[10px]" />
      </span>
    </RouterLink>

    <!-- Loading -->
    <div v-if="store.isLoading" class="mx-auto max-w-5xl space-y-16">
      <div class="animate-pulse overflow-hidden rounded-3xl bg-gray-900">
        <div class="grid gap-0 md:grid-cols-5">
          <div class="space-y-5 p-10 md:col-span-3">
            <div class="h-3 w-40 rounded bg-white/10" />
            <div class="h-10 w-2/3 rounded bg-white/10" />
            <div class="h-4 w-full rounded bg-white/10" />
            <div class="h-4 w-11/12 rounded bg-white/10" />
          </div>
          <div class="space-y-5 bg-gradient-to-br from-violet-600/60 to-violet-900/60 p-10 md:col-span-2">
            <div class="h-3 w-24 rounded bg-white/20" />
            <div class="h-16 w-40 rounded bg-white/20" />
            <div class="h-24 w-full rounded bg-white/20" />
          </div>
        </div>
      </div>
      <div class="grid gap-10 md:grid-cols-2">
        <div v-for="i in 4" :key="i" class="space-y-3">
          <div class="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div class="h-8 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
          <div class="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
          <div class="h-16 w-full rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <!-- Empty -->
    <div
      v-else-if="!store.hasData"
      class="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
        <FontAwesomeIcon icon="robot" class="text-2xl text-violet-500 dark:text-violet-400" />
      </div>
      <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('aiRecommendation.empty') }}</p>
    </div>

    <template v-else>
      <!-- HERO -->
      <RouterLink
        v-if="hero"
        :to="routeForCompany(hero.ticker)"
        class="group mx-auto mb-16 block max-w-5xl cursor-pointer overflow-hidden rounded-3xl bg-gray-900 text-white transition-shadow hover:shadow-2xl hover:shadow-violet-500/20"
      >
        <div class="grid gap-0 md:grid-cols-5">
          <!-- Left: editorial copy -->
          <div class="p-8 sm:p-10 md:col-span-3">
            <div class="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-violet-300">
              <span>{{ t('aiRecommendation.pickOfTheWeek') }}</span>
              <span>·</span>
              <span>{{ t('aiRecommendation.rankNumber', { rank: hero.rank }) }}</span>
              <span
                v-if="hero.qualifyingTier"
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal"
                :class="tierConfig[hero.qualifyingTier].pill"
                :title="t(tierConfig[hero.qualifyingTier].desc)"
              >
                <FontAwesomeIcon icon="shield-halved" class="text-[9px]" />
                {{ t(tierConfig[hero.qualifyingTier].label) }}
              </span>
              <span class="ml-auto flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full" :class="statusConfig[hero.status].dot"></span>
                <span>{{ t(statusConfig[hero.status].label) }}</span>
              </span>
            </div>
            <h2 class="text-3xl font-bold leading-tight sm:text-4xl" :style="{ fontFamily: SERIF }">
              {{ hero.company }}
            </h2>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
              <span class="font-mono text-violet-300">{{ hero.ticker }}</span>
              <span>·</span>
              <span>{{ countryFlag(hero.countryCode) }} {{ hero.country }}</span>
              <span>·</span>
              <span>{{ hero.sector }}</span>
              <span class="hidden sm:inline">·</span>
              <span class="hidden sm:inline">{{ hero.exchange }}</span>
            </div>
            <p class="mt-8 text-base leading-relaxed text-gray-200 sm:text-lg">
              {{ localized(hero.pro) }}
            </p>
            <blockquote
              class="mt-8 border-l-4 border-violet-400 pl-5 text-lg leading-snug text-white sm:text-xl"
              :style="{ fontFamily: SERIF }"
            >
              &ldquo;{{ localized(hero.con) }}&rdquo;
            </blockquote>
            <div class="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-300 transition-transform group-hover:translate-x-1">
              {{ t('aiRecommendation.readFullAnalysis') }}
              <FontAwesomeIcon icon="arrow-right" class="text-[10px]" />
            </div>
          </div>

          <!-- Right: metrics column -->
          <div class="flex flex-col justify-between gap-6 border-t border-white/10 bg-gradient-to-br from-violet-600 to-violet-900 p-8 sm:p-10 md:col-span-2 md:border-l md:border-t-0">
            <div>
              <div class="text-xs uppercase tracking-widest text-violet-200" :title="t('aiRecommendation.yieldLabel')">
                {{ t('aiRecommendation.yieldLabel') }}
              </div>
              <div class="mt-1 flex items-baseline gap-2">
                <div class="text-6xl font-bold tracking-tight sm:text-7xl">{{ hero.dividendYield.toFixed(1) }}</div>
                <div class="text-3xl font-semibold text-violet-200">%</div>
              </div>
              <div class="mt-1 text-xs text-violet-200">
                {{ formatPrice(hero.annualDividend, hero.currency) }}/yr · {{ formatPrice(hero.currentPrice, hero.currency) }}
              </div>
              <div
                v-if="showInflationBadge && inflationBeat(hero)"
                class="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                :class="beatPalette[inflationBeat(hero)!.verdict].pill"
                :title="beatTooltip(inflationBeat(hero)!)"
              >
                <FontAwesomeIcon :icon="beatPalette[inflationBeat(hero)!.verdict].icon" class="text-[9px]" />
                {{ beatShortText(inflationBeat(hero)!) }}
              </div>
            </div>

            <!-- Yield history bar chart -->
            <div>
              <div class="mb-3 text-xs uppercase tracking-widest text-violet-200">
                {{ t('aiRecommendation.yieldHistory') }}
              </div>
              <div v-if="hero.historicYields === null" class="flex h-[72px] animate-pulse items-end gap-2">
                <div
                  v-for="k in 5"
                  :key="k"
                  class="flex-1 rounded-t-sm bg-white/20"
                  :style="{ height: `${20 + k * 8}px` }"
                />
              </div>
              <div v-else class="flex h-[72px] items-end gap-2">
                <div
                  v-for="h in hero.historicYields"
                  :key="h.year"
                  class="flex flex-1 flex-col items-center gap-1"
                >
                  <span class="text-[10px] font-medium text-white">{{ h.yield.toFixed(1) }}%</span>
                  <div
                    class="w-full rounded-t-sm bg-white/80"
                    :style="{ height: barHeightPx(h, hero.historicYields, 40) }"
                  />
                  <span class="text-[10px] text-violet-200">{{ h.year }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between rounded-2xl bg-black/20 p-4">
              <div>
                <div class="text-xs uppercase tracking-widest text-violet-200">{{ t('aiRecommendation.marketCap') }}</div>
                <div class="mt-0.5 text-lg font-bold">{{ formatMarketCap(hero.marketCap) }}</div>
              </div>
              <div class="text-right">
                <div class="text-xs uppercase tracking-widest text-violet-200">{{ t('aiRecommendation.price') }}</div>
                <div
                  class="mt-0.5 flex items-center justify-end gap-1 text-sm"
                  :class="hero.priceChangePercent >= 0 ? 'text-emerald-300' : 'text-red-300'"
                >
                  <FontAwesomeIcon :icon="hero.priceChangePercent >= 0 ? 'arrow-up' : 'arrow-down'" class="text-[9px]" />
                  {{ Math.abs(hero.priceChangePercent).toFixed(2) }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </RouterLink>

      <!-- STRATEGY TIER LEGEND -->
      <section
        class="mx-auto mb-12 max-w-5xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-800 dark:bg-gray-900"
      >
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {{ t('aiRecommendation.tierLegendTitle') }}
        </h3>
        <p class="mb-5 text-sm text-gray-600 dark:text-gray-400">
          {{ t('aiRecommendation.tierLegendBody') }}
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            v-for="tierKey in (['conservative','moderate','permissive'] as const)"
            :key="tierKey"
            class="rounded-xl border p-4"
            :class="tierConfig[tierKey].pill"
          >
            <div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
              <FontAwesomeIcon icon="shield-halved" :class="tierConfig[tierKey].iconColor" />
              <span>{{ t(tierConfig[tierKey].label) }}</span>
            </div>
            <p class="text-xs leading-relaxed">
              {{ t(tierConfig[tierKey].desc) }}
            </p>
          </div>
        </div>
      </section>

      <!-- ABOUT THESE PICKS — methodology, not-financial-advice, conflicts -->
      <section
        class="mx-auto mb-16 max-w-5xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-800 dark:bg-gray-900"
      >
        <h3 class="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {{ t('aiRecommendation.disclaimer.aboutTitle') }}
        </h3>
        <div class="space-y-5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
          <div>
            <h4 class="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              {{ t('aiRecommendation.disclaimer.aboutMethodologyTitle') }}
            </h4>
            <p>{{ t('aiRecommendation.disclaimer.aboutMethodology') }}</p>
          </div>
          <div>
            <h4 class="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              {{ t('aiRecommendation.disclaimer.aboutNotAdviceTitle') }}
            </h4>
            <p>{{ t('aiRecommendation.disclaimer.aboutNotAdvice') }}</p>
          </div>
          <div>
            <h4 class="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              {{ t('aiRecommendation.disclaimer.aboutConflictsTitle') }}
            </h4>
            <p>{{ t('aiRecommendation.disclaimer.aboutConflicts') }}</p>
          </div>
        </div>
      </section>

      <!-- ALSO IN THE RANKING -->
      <section v-if="rest.length" class="mx-auto max-w-5xl">
        <div class="mb-6 flex items-baseline justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
          <h3 class="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white" :style="{ fontFamily: SERIF }">
            {{ t('aiRecommendation.alsoRanking') }}
          </h3>
          <span class="text-xs uppercase tracking-widest text-gray-400">
            {{ t('aiRecommendation.morePicks', { count: rest.length }) }}
          </span>
        </div>
        <div class="grid gap-6 md:grid-cols-2">
          <RouterLink
            v-for="p in rest"
            :key="p.ticker"
            :to="routeForCompany(p.ticker)"
            class="group block cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-700"
          >
            <div class="mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest">
              <span class="h-1.5 w-1.5 rounded-full" :class="statusConfig[p.status].dot"></span>
              <span :class="statusConfig[p.status].text">{{ t(statusConfig[p.status].label) }}</span>
              <span class="text-gray-400">· {{ t('aiRecommendation.rankNumber', { rank: p.rank }) }}</span>
              <span
                v-if="p.qualifyingTier"
                class="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal"
                :class="tierConfig[p.qualifyingTier].pill"
                :title="t(tierConfig[p.qualifyingTier].desc)"
              >
                <FontAwesomeIcon icon="shield-halved" class="text-[8px]" />
                {{ t(tierConfig[p.qualifyingTier].label) }}
              </span>
              <FontAwesomeIcon
                icon="arrow-right"
                class="ml-auto text-[10px] text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500 dark:text-gray-600"
              />
            </div>
            <h4 class="text-xl font-bold leading-tight text-gray-900 sm:text-2xl dark:text-white" :style="{ fontFamily: SERIF }">
              {{ p.company }}
            </h4>
            <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
              <span class="font-mono text-violet-600 dark:text-violet-400">{{ p.ticker }}</span>
              <span>·</span>
              <span>{{ countryFlag(p.countryCode) }} {{ p.country }}</span>
              <span>·</span>
              <span>{{ p.sector }}</span>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-gray-600 line-clamp-2 dark:text-gray-400">
              {{ localized(p.pro) }}
            </p>

            <!-- Compact yield bar chart -->
            <div class="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-gray-400">
                    {{ t('aiRecommendation.yieldLabel') }}
                  </div>
                  <div
                    class="text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl dark:text-white"
                    :title="
                      showInflationBadge && inflationBeat(p) ? beatTooltip(inflationBeat(p)!) : ''
                    "
                  >
                    {{ p.dividendYield.toFixed(1) }}<span class="text-base text-gray-400">%</span>
                  </div>
                  <div
                    v-if="showInflationBadge && inflationBeat(p)"
                    class="mt-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                    :class="beatPalette[inflationBeat(p)!.verdict].pill"
                    :title="beatTooltip(inflationBeat(p)!)"
                  >
                    <FontAwesomeIcon :icon="beatPalette[inflationBeat(p)!.verdict].icon" class="text-[8px]" />
                    {{ beatShortText(inflationBeat(p)!) }}
                  </div>
                </div>

                <div v-if="p.historicYields === null" class="flex h-10 w-[140px] animate-pulse items-end gap-1">
                  <div v-for="k in 5" :key="k" class="flex-1 rounded-t-sm bg-gray-200 dark:bg-gray-700" :style="{ height: `${12 + k * 4}px` }" />
                </div>
                <div v-else class="flex h-10 w-[140px] items-end gap-1">
                  <div
                    v-for="h in p.historicYields"
                    :key="h.year"
                    class="flex flex-1 flex-col items-center gap-0.5"
                  >
                    <div
                      class="w-full rounded-t-sm bg-violet-500 dark:bg-violet-400"
                      :style="{ height: barHeightPx(h, p.historicYields, 30) }"
                    />
                    <span class="text-[8px] text-gray-400">{{ String(h.year).slice(-2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </RouterLink>
        </div>
      </section>
    </template>

  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
