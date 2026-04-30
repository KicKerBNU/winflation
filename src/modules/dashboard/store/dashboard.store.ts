import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useMonthlyDyStore } from '@/modules/monthly-dy/store/monthly-dy.store'
import { useAiRecommendationStore } from '@/modules/ai-recommendation/store/ai-recommendation.store'
import { useInflationStore } from '@/modules/inflation/store/inflation.store'
import { useDividendsStore } from '@/modules/dividends/store/dividends.store'
import type { MonthlyDyPick } from '@/modules/monthly-dy/domain/monthly-dy.types'
import type { AiCompanyCard } from '@/modules/ai-recommendation/domain/ai-recommendation.types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpcomingDividend {
  ticker: string
  company: string
  countryCode: string | null
  sector: string | null
  currency: string | null
  source: 'monthly-dy' | 'ai-pick'
  dividendYield: number
  paymentFrequency: number
  dividendAmount: number
  nextExDividendDate: string
  nextPaymentDate: string | null
}

// ─── Pure helpers (exported so components can reuse) ─────────────────────────

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(`${iso}T00:00:00Z`).getTime()
  if (Number.isNaN(target)) return null
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function toDividendAmount(
  lastDividendAmount: number | null | undefined,
  annualDividend: number,
  paymentFrequency: number | null | undefined,
): number | null {
  if (lastDividendAmount && lastDividendAmount > 0) return lastDividendAmount
  if (annualDividend > 0 && paymentFrequency && paymentFrequency > 0) {
    return annualDividend / paymentFrequency
  }
  return null
}


function monthlyDyToUpcoming(pick: MonthlyDyPick): UpcomingDividend | null {
  const amount = toDividendAmount(pick.lastDividendAmount, pick.annualDividend, pick.paymentFrequency)
  const { nextExDividendDate } = pick
  if (!amount || !nextExDividendDate) return null
  const exDays = daysUntil(nextExDividendDate)
  if (exDays === null || exDays <= 0) return null
  return {
    ticker: pick.ticker,
    company: pick.company,
    countryCode: pick.countryCode,
    sector: pick.sector,
    currency: pick.currency,
    source: 'monthly-dy',
    dividendYield: pick.dividendYield,
    paymentFrequency: pick.paymentFrequency,
    dividendAmount: amount,
    nextExDividendDate,
    nextPaymentDate: pick.nextPaymentDate ?? null,
  }
}

function aiPickToUpcoming(card: AiCompanyCard): UpcomingDividend | null {
  const frequency =
    card.paymentFrequency ??
    card.dividendsPerYear?.find((year) => year.payments > 0)?.payments ??
    null
  const amount = toDividendAmount(card.lastDividendAmount, card.annualDividend, frequency)
  const { nextExDividendDate } = card
  if (!amount || !frequency || !nextExDividendDate) return null
  const exDays = daysUntil(nextExDividendDate)
  if (exDays === null || exDays <= 0) return null
  return {
    ticker: card.ticker,
    company: card.company,
    countryCode: card.countryCode,
    sector: card.sector,
    currency: card.currency,
    source: 'ai-pick',
    dividendYield: card.dividendYield,
    paymentFrequency: frequency,
    dividendAmount: amount,
    nextExDividendDate,
    nextPaymentDate: card.nextPaymentDate ?? null,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = defineStore('dashboard', () => {
  const monthlyDyStore = useMonthlyDyStore()
  const aiRecommendationStore = useAiRecommendationStore()
  const inflationStore = useInflationStore()
  const dividendsStore = useDividendsStore()

  // ── Upcoming ex-dividends ──────────────────────────────────────────────────

  const allUpcomingDividends = computed<UpcomingDividend[]>(() => {
    const byTicker = new Map<string, UpcomingDividend>()
    const candidates = [
      ...monthlyDyStore.picks.map(monthlyDyToUpcoming),
      ...aiRecommendationStore.cards.map(aiPickToUpcoming),
    ].filter((item): item is UpcomingDividend => item !== null)

    for (const item of candidates) {
      const existing = byTicker.get(item.ticker)
      if (
        !existing ||
        item.nextExDividendDate < existing.nextExDividendDate ||
        (item.nextExDividendDate === existing.nextExDividendDate && item.source === 'monthly-dy')
      ) {
        byTicker.set(item.ticker, item)
      }
    }

    return [...byTicker.values()].sort((a, b) => {
      const dateDiff = a.nextExDividendDate.localeCompare(b.nextExDividendDate)
      if (dateDiff !== 0) return dateDiff
      return b.dividendYield - a.dividendYield
    })
  })

  // All future ex-dividends, no window restriction
  const upcomingDividends = computed(() => allUpcomingDividends.value)

  // Label helper: are any companies ex-dividend in the next 7 days?
  const upcomingDividendsWindowIs7Days = computed(() =>
    allUpcomingDividends.value.some((item) => {
      const days = daysUntil(item.nextExDividendDate)
      return days !== null && days <= 7
    }),
  )

  const exDividendMarqueeDuration = computed(() => {
    const n = upcomingDividends.value.length
    if (n < 4) return '0s'
    return `${Math.max(56, n * 5.6)}s`
  })

  // ── Top dividend opportunities ─────────────────────────────────────────────

  const topStocks = computed(() => dividendsStore.sortedByYield.slice(0, 5))

  // ── Lowest inflation countries ─────────────────────────────────────────────

  const topInflation = computed(() => inflationStore.lowestInflation)

  const allInflationAsc = computed(() => [...inflationStore.sorted].reverse())

  const marqueeDuration = computed(() => {
    const n = allInflationAsc.value.length
    if (n < 6) return '0s'
    return `${Math.max(40, n * 2.3)}s`
  })

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async function init() {
    await Promise.all([
      inflationStore.init(),
      dividendsStore.init(),
      monthlyDyStore.init(),
      aiRecommendationStore.init(),
    ])
  }

  return {
    // Upcoming ex-dividends
    upcomingDividends,
    upcomingDividendsWindowIs7Days,
    exDividendMarqueeDuration,
    // Top dividend opportunities
    topStocks,
    // Lowest inflation countries
    topInflation,
    allInflationAsc,
    marqueeDuration,
    // Lifecycle
    init,
  }
})
