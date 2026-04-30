<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '../store/dashboard.store'

const { t } = useI18n()
const router = useRouter()
const store = useDashboardStore()

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}
</script>

<template>
  <div class="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('dashboard.lowestInflation') }}</h2>
      <button
        class="cursor-pointer text-xs text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
        @click="router.push('/inflation')"
      >
        {{ t('dashboard.viewAll') }} →
      </button>
    </div>

    <!-- Static fallback when list is too short to loop -->
    <div v-if="store.allInflationAsc.length < 6" class="space-y-3">
      <div
        v-for="country in store.topInflation"
        :key="country.countryCode"
        class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
        @click="router.push(`/inflation/${country.countryCode.toLowerCase()}`)"
      >
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ countryFlag(country.countryCode) }}</span>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ country.country }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ country.date }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="country.trend === 'up'
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : country.trend === 'down'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
          >
            <FontAwesomeIcon
              :icon="country.trend === 'up' ? 'arrow-up' : country.trend === 'down' ? 'arrow-down' : 'minus'"
              class="text-[10px]"
            />
            {{ country.trend === 'up' ? t('dashboard.trendRising') : country.trend === 'down' ? t('dashboard.trendFalling') : t('dashboard.trendStable') }}
          </span>
          <span class="text-sm font-bold text-gray-900 dark:text-white">{{ country.rate.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- Marquee: 5-row window, content duplicated for seamless loop -->
    <div
      v-else
      class="inflation-marquee"
      :style="{ '--marquee-duration': store.marqueeDuration }"
    >
      <div class="inflation-marquee-track">
        <!-- Original list -->
        <div
          v-for="country in store.allInflationAsc"
          :key="country.countryCode"
          class="inflation-row flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
          @click="router.push(`/inflation/${country.countryCode.toLowerCase()}`)"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ countryFlag(country.countryCode) }}</span>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ country.country }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ country.date }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="country.trend === 'up'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : country.trend === 'down'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
            >
              <FontAwesomeIcon
                :icon="country.trend === 'up' ? 'arrow-up' : country.trend === 'down' ? 'arrow-down' : 'minus'"
                class="text-[10px]"
              />
              {{ country.trend === 'up' ? t('dashboard.trendRising') : country.trend === 'down' ? t('dashboard.trendFalling') : t('dashboard.trendStable') }}
            </span>
            <span class="text-sm font-bold text-gray-900 dark:text-white">{{ country.rate.toFixed(1) }}%</span>
          </div>
        </div>
        <!-- Duplicate for seamless loop (hidden from screen readers) -->
        <div
          v-for="country in store.allInflationAsc"
          :key="country.countryCode + '-clone'"
          aria-hidden="true"
          class="inflation-row flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
          @click="router.push(`/inflation/${country.countryCode.toLowerCase()}`)"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ countryFlag(country.countryCode) }}</span>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ country.country }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ country.date }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="country.trend === 'up'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : country.trend === 'down'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
            >
              <FontAwesomeIcon
                :icon="country.trend === 'up' ? 'arrow-up' : country.trend === 'down' ? 'arrow-down' : 'minus'"
                class="text-[10px]"
              />
              {{ country.trend === 'up' ? t('dashboard.trendRising') : country.trend === 'down' ? t('dashboard.trendFalling') : t('dashboard.trendStable') }}
            </span>
            <span class="text-sm font-bold text-gray-900 dark:text-white">{{ country.rate.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inflation-marquee {
  position: relative;
  height: calc(5 * 62px + 4 * 12px);
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 8%, black 92%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, black 8%, black 92%, transparent 100%);
}
.inflation-marquee-track {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: inflation-scroll var(--marquee-duration, 60s) linear infinite;
  will-change: transform;
}
.inflation-marquee:hover .inflation-marquee-track {
  animation-play-state: paused;
}
.inflation-row {
  min-height: 62px;
  flex-shrink: 0;
}
@keyframes inflation-scroll {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .inflation-marquee-track { animation: none; }
}
</style>
