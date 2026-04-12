<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useInflationStore } from './store/inflation.store'
import { useInterestRateStore } from '@/modules/interest-rate/store/interest-rate.store'
import type { CountryInflation } from './domain/inflation.types'

const { t } = useI18n()
const router = useRouter()
const store = useInflationStore()
const rateStore = useInterestRateStore()

onMounted(() => Promise.all([store.init(), rateStore.init()]))

const search = ref('')
type Filter = 'all' | 'high' | 'medium' | 'low'
const activeFilter = ref<Filter>('all')

const filters: Filter[] = ['all', 'high', 'medium', 'low']

const filtered = computed(() => {
  const ecbRate = rateStore.depositRate?.rate ?? 0
  return store.sorted
    .filter((c: CountryInflation) => {
      const matchesSearch = c.country.toLowerCase().includes(search.value.toLowerCase())
      if (activeFilter.value === 'high') return matchesSearch && c.rate > 4
      if (activeFilter.value === 'medium') return matchesSearch && c.rate >= 2 && c.rate <= 4
      if (activeFilter.value === 'low') return matchesSearch && c.rate < 2
      return matchesSearch
    })
    .map((c) => ({ ...c, vsEcb: +(c.rate - ecbRate).toFixed(2) }))
})

function rateBadgeClass(rate: number): string {
  if (rate > 4) return 'bg-red-500/10 text-red-500 border-red-500/20 dark:text-red-400'
  if (rate >= 2) return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
  return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
}

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('inflation.title') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('inflation.subtitle') }}</p>
      <p v-if="store.countries.length" class="mt-1 text-xs text-amber-600 dark:text-amber-500">
        {{ t('inflation.dataLag', { date: store.countries[0]?.date }) }}
      </p>
    </div>

    <!-- Controls -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="relative">
        <FontAwesomeIcon
          icon="magnifying-glass"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500"
        />
        <input
          v-model="search"
          type="text"
          :placeholder="t('inflation.searchPlaceholder')"
          class="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 sm:w-auto"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="f in filters"
          :key="f"
          class="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            activeFilter === f
              ? 'bg-violet-600 text-white'
              : 'border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-white'
          "
          @click="activeFilter = f"
        >
          {{ t(`inflation.filter${f.charAt(0).toUpperCase() + f.slice(1)}`) }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
      <FontAwesomeIcon icon="circle-notch" spin class="mr-2" />
      {{ t('inflation.loading') }}
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <!-- Table -->
    <div
      v-else
      class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[400px]">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:px-6 sm:py-4">
                {{ t('inflation.country') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:px-6 sm:py-4">
                {{ t('inflation.rate') }}
              </th>
              <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:table-cell sm:px-6 sm:py-4">
                {{ t('inflation.trend') }}
              </th>
              <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:table-cell sm:px-6 sm:py-4">
                {{ t('inflation.vsEcb') }}
              </th>
              <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 md:table-cell md:px-6 md:py-4">
                {{ t('inflation.date') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="country in filtered"
              :key="country.countryCode"
              class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              @click="router.push('/inflation/' + country.countryCode.toLowerCase())"
            >
              <td class="px-4 py-3 sm:px-6 sm:py-4">
                <div class="flex items-center gap-2 sm:gap-3">
                  <span class="text-lg sm:text-xl">{{ countryFlag(country.countryCode) }}</span>
                  <div>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ country.country }}</span>
                    <!-- show trend inline on mobile -->
                    <div class="mt-0.5 flex items-center gap-1 sm:hidden">
                      <FontAwesomeIcon
                        :icon="country.trend === 'up' ? 'arrow-up' : country.trend === 'down' ? 'arrow-down' : 'minus'"
                        :class="country.trend === 'up' ? 'text-red-500' : 'text-emerald-500'"
                        class="text-[10px]"
                      />
                      <span
                        class="text-xs font-medium"
                        :class="country.vsEcb > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
                      >
                        vs ECB {{ country.vsEcb > 0 ? '+' : '' }}{{ country.vsEcb }}%
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 sm:px-6 sm:py-4">
                <span
                  class="rounded-full border px-2.5 py-1 text-sm font-bold"
                  :class="rateBadgeClass(country.rate)"
                >
                  {{ country.rate.toFixed(1) }}%
                </span>
              </td>
              <td class="hidden px-4 py-3 sm:table-cell sm:px-6 sm:py-4">
                <FontAwesomeIcon
                  :icon="country.trend === 'up' ? 'arrow-up' : country.trend === 'down' ? 'arrow-down' : 'minus'"
                  :class="country.trend === 'up' ? 'text-red-500' : 'text-emerald-500'"
                />
              </td>
              <td class="hidden px-4 py-3 sm:table-cell sm:px-6 sm:py-4">
                <span
                  :class="country.vsEcb > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
                  class="text-sm font-medium"
                >
                  {{ country.vsEcb > 0 ? '+' : '' }}{{ country.vsEcb }}%
                </span>
              </td>
              <td class="hidden px-4 py-3 text-sm text-gray-400 dark:text-gray-500 md:table-cell md:px-6 md:py-4">
                {{ country.date }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtered.length === 0" class="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
        {{ t('inflation.noResults') }}
      </div>
    </div>
  </div>
</template>
