<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDashboardStore, daysUntil } from '../store/dashboard.store'
import type { UpcomingDividend } from '../store/dashboard.store'

const { t, locale } = useI18n()
const router = useRouter() // still used for card click navigation
const store = useDashboardStore()

// ─── Formatting helpers ───────────────────────────────────────────────────────

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function flagOrFallback(code: string | null): string {
  return code ? countryFlag(code) : '·'
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: 'short' })
}

function formatPrice(amount: number, currency: string | null): string {
  if (!currency) return amount.toFixed(2)
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function paymentCountdownText(item: UpcomingDividend): string {
  const days = daysUntil(item.nextPaymentDate)
  if (days === 1) return t('dashboard.paymentTomorrow')
  if (days !== null && days > 1) return t('dashboard.paymentInDays', { days })
  return t('dashboard.paymentDate', { date: formatDate(item.nextPaymentDate) })
}

function routeForUpcoming(item: UpcomingDividend) {
  if (item.source === 'monthly-dy') {
    return { name: 'monthly-dy-detail', params: { ticker: encodeURIComponent(item.ticker) } }
  }
  if (item.source === 'quarterly-dy') {
    return { name: 'quarterly-dy-detail', params: { ticker: encodeURIComponent(item.ticker) } }
  }
  return { name: 'ai-recommendation-detail', params: { ticker: encodeURIComponent(item.ticker) } }
}

function sourceLabel(item: UpcomingDividend): string {
  if (item.source === 'monthly-dy') return t('dashboard.sourceMonthlyDy')
  if (item.source === 'quarterly-dy') return t('dashboard.sourceQuarterlyDy')
  return t('dashboard.sourceAiPicks')
}
</script>

<template>
  <div class="mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-gray-900 dark:to-violet-950/20">
    <div class="mb-5">
      <div class="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
        <FontAwesomeIcon icon="calendar" class="text-[10px]" />
        <span>{{ store.upcomingDividendsWindowIs7Days ? t('dashboard.next7Days') : t('dashboard.next30Days') }}</span>
      </div>
      <h2 class="mt-3 text-xl font-bold text-gray-900 dark:text-white">{{ t('dashboard.upcomingExDividends') }}</h2>
      <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
        {{ t('dashboard.upcomingExDividendsSubtitle') }}
      </p>
    </div>

    <!-- Empty state -->
    <div
      v-if="store.upcomingDividends.length === 0"
      class="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400"
    >
      {{ t('dashboard.noUpcomingExDividends') }}
    </div>

    <!-- Static grid (< 4 items) -->
    <div
      v-else-if="store.upcomingDividends.length < 4"
      class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
    >
      <button
        v-for="item in store.upcomingDividends"
        :key="item.ticker"
        class="cursor-pointer rounded-2xl border border-white/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        @click="router.push(routeForUpcoming(item))"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <span class="mt-0.5 flex-shrink-0 text-2xl">{{ flagOrFallback(item.countryCode) }}</span>
            <div class="min-w-0">
              <p class="ex-dividend-company-name text-sm font-semibold text-gray-900 dark:text-white">{{ item.company }}</p>
              <p class="truncate text-xs text-gray-400 dark:text-gray-500">{{ item.ticker }} · {{ item.sector }}</p>
            </div>
          </div>
          <span class="flex-shrink-0 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
            {{ sourceLabel(item) }}
          </span>
        </div>

        <div class="mt-4 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
          <p class="text-xs text-emerald-700 dark:text-emerald-300">{{ t('dashboard.paymentValue') }}</p>
          <div class="mt-1 flex items-end justify-between gap-3">
            <p class="text-lg font-bold text-gray-900 dark:text-white">{{ formatPrice(item.dividendAmount, item.currency) }}</p>
            <p class="text-right text-xs font-semibold text-emerald-700 dark:text-emerald-300">{{ paymentCountdownText(item) }}</p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.exDividendDate') }}</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatDate(item.nextExDividendDate) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.dividendYield') }}</p>
            <p class="font-semibold text-emerald-600 dark:text-emerald-400">{{ item.dividendYield.toFixed(1) }}%</p>
          </div>
          <div class="min-w-0">
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.paymentsPerYear') }}</p>
            <p class="truncate font-semibold text-gray-900 dark:text-white">{{ t('dashboard.paymentFrequency', { count: item.paymentFrequency }) }}</p>
          </div>
        </div>
      </button>
    </div>

    <!-- Auto-scrolling marquee (≥ 4 items) -->
    <div
      v-else
      class="ex-dividend-marquee"
      :style="{ '--ex-dividend-marquee-duration': store.exDividendMarqueeDuration }"
    >
      <div class="ex-dividend-marquee-track">
        <!-- Original set -->
        <button
          v-for="item in store.upcomingDividends"
          :key="item.ticker"
          class="ex-dividend-card cursor-pointer rounded-2xl border border-white/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          @click="router.push(routeForUpcoming(item))"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <span class="mt-0.5 flex-shrink-0 text-2xl">{{ flagOrFallback(item.countryCode) }}</span>
              <div class="min-w-0">
                <p class="ex-dividend-company-name text-sm font-semibold text-gray-900 dark:text-white">{{ item.company }}</p>
                <p class="truncate text-xs text-gray-400 dark:text-gray-500">{{ item.ticker }} · {{ item.sector }}</p>
              </div>
            </div>
            <span class="flex-shrink-0 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
              {{ sourceLabel(item) }}
            </span>
          </div>

          <div class="mt-4 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
            <p class="text-xs text-emerald-700 dark:text-emerald-300">{{ t('dashboard.paymentValue') }}</p>
            <div class="mt-1 flex items-end justify-between gap-3">
              <p class="text-lg font-bold text-gray-900 dark:text-white">{{ formatPrice(item.dividendAmount, item.currency) }}</p>
              <p class="text-right text-xs font-semibold text-emerald-700 dark:text-emerald-300">{{ paymentCountdownText(item) }}</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.exDividendDate') }}</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ formatDate(item.nextExDividendDate) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.dividendYield') }}</p>
              <p class="font-semibold text-emerald-600 dark:text-emerald-400">{{ item.dividendYield.toFixed(1) }}%</p>
            </div>
            <div class="min-w-0">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.paymentsPerYear') }}</p>
              <p class="truncate font-semibold text-gray-900 dark:text-white">{{ t('dashboard.paymentFrequency', { count: item.paymentFrequency }) }}</p>
            </div>
          </div>
        </button>

        <!-- Duplicate set for seamless loop -->
        <button
          v-for="item in store.upcomingDividends"
          :key="item.ticker + '-clone'"
          aria-hidden="true"
          class="ex-dividend-card cursor-pointer rounded-2xl border border-white/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          @click="router.push(routeForUpcoming(item))"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <span class="mt-0.5 flex-shrink-0 text-2xl">{{ flagOrFallback(item.countryCode) }}</span>
              <div class="min-w-0">
                <p class="ex-dividend-company-name text-sm font-semibold text-gray-900 dark:text-white">{{ item.company }}</p>
                <p class="truncate text-xs text-gray-400 dark:text-gray-500">{{ item.ticker }} · {{ item.sector }}</p>
              </div>
            </div>
            <span class="flex-shrink-0 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
              {{ sourceLabel(item) }}
            </span>
          </div>

          <div class="mt-4 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
            <p class="text-xs text-emerald-700 dark:text-emerald-300">{{ t('dashboard.paymentValue') }}</p>
            <div class="mt-1 flex items-end justify-between gap-3">
              <p class="text-lg font-bold text-gray-900 dark:text-white">{{ formatPrice(item.dividendAmount, item.currency) }}</p>
              <p class="text-right text-xs font-semibold text-emerald-700 dark:text-emerald-300">{{ paymentCountdownText(item) }}</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.exDividendDate') }}</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ formatDate(item.nextExDividendDate) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.dividendYield') }}</p>
              <p class="font-semibold text-emerald-600 dark:text-emerald-400">{{ item.dividendYield.toFixed(1) }}%</p>
            </div>
            <div class="min-w-0">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('dashboard.paymentsPerYear') }}</p>
              <p class="truncate font-semibold text-gray-900 dark:text-white">{{ t('dashboard.paymentFrequency', { count: item.paymentFrequency }) }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ex-dividend-marquee {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to right, transparent 0, black 5%, black 95%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, black 5%, black 95%, transparent 100%);
}
.ex-dividend-marquee-track {
  display: flex;
  gap: 16px;
  width: max-content;
  animation: ex-dividend-scroll var(--ex-dividend-marquee-duration, 56s) linear infinite;
  will-change: transform;
}
.ex-dividend-marquee:hover .ex-dividend-marquee-track {
  animation-play-state: paused;
}
.ex-dividend-card {
  width: min(340px, calc(100vw - 80px));
  flex-shrink: 0;
}
.ex-dividend-company-name {
  display: -webkit-box;
  min-height: 40px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
@keyframes ex-dividend-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .ex-dividend-marquee-track { animation: none; }
}
</style>
