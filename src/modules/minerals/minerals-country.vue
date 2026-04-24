<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useMineralsStore } from './store/minerals.store'
import type { CompanyStage, RiskLevel } from './domain/minerals.types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useMineralsStore()

onMounted(() => store.init())

const countryCode = computed(() => String(route.params.countryCode ?? '').toUpperCase())

const country = computed(() => store.countryByCode.get(countryCode.value))

const countryMinerals = computed(() => {
  if (!country.value) return []
  return country.value.minerals
    .map((symbol) => store.mineralBySymbol.get(symbol))
    .filter((m): m is NonNullable<typeof m> => !!m)
})

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function categoryBadge(category: string): string {
  if (category === 'magnet')
    return 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400'
  if (category === 'battery')
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
  return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400'
}

function stageBadge(stage: CompanyStage): string {
  if (stage === 'producer')
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
  if (stage === 'developer')
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
  return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400'
}

function riskBadge(risk: RiskLevel): string {
  if (risk === 'low')
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
  if (risk === 'moderate')
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
  return 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400'
}

function profitabilityKey(p: string): string {
  return p === 'not-yet' ? 'notYet' : p
}
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <button
      class="mb-6 flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400"
      @click="router.push('/minerals')"
    >
      <FontAwesomeIcon icon="arrow-left" />
      {{ t('mineralsCountry.back') }}
    </button>

    <!-- Loading -->
    <div v-if="store.isLoading" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
      <FontAwesomeIcon icon="circle-notch" spin class="mr-2" />
      {{ t('minerals.loading') }}
    </div>

    <!-- Not found -->
    <div
      v-else-if="!country"
      class="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
    >
      {{ t('mineralsCountry.notFound') }}
    </div>

    <template v-else>
      <!-- Country header -->
      <div class="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="flex items-start gap-4">
          <span class="text-4xl">{{ countryFlag(country.countryCode) }}</span>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ t(country.nameKey) }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t(country.statusKey) }}
            </p>
            <div class="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
              <div class="flex items-center gap-1.5">
                <FontAwesomeIcon icon="gem" class="text-violet-500" />
                {{ t('mineralsCountry.mineralsCount', { count: country.minerals.length }) }}
              </div>
              <div class="flex items-center gap-1.5">
                <FontAwesomeIcon icon="building" class="text-violet-500" />
                {{ t('mineralsCountry.companiesCount', { count: country.companies.length }) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Two columns: minerals + companies -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Minerals found -->
        <section
          class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('mineralsCountry.mineralsTitle') }}
            </h2>
          </div>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="mineral in countryMinerals"
              :key="mineral.symbol"
              class="flex items-start gap-3 px-5 py-4"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white"
              >
                {{ mineral.symbol }}
              </span>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ t(mineral.nameKey) }}
                  </p>
                  <span
                    class="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                    :class="categoryBadge(mineral.category)"
                  >
                    {{ t(`minerals.category.${mineral.category}`) }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {{ t(mineral.useKey) }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <!-- Companies operating -->
        <section
          class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('mineralsCountry.companiesTitle') }}
            </h2>
          </div>
          <div
            v-if="country.companies.length === 0"
            class="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500"
          >
            {{ t('mineralsCountry.companiesEmpty') }}
          </div>
          <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="company in country.companies"
              :key="company.name"
              class="flex flex-col gap-3 px-5 py-4"
            >
              <!-- Header: name, ticker, badges -->
              <div class="flex items-start gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                >
                  <FontAwesomeIcon icon="building" />
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">
                      {{ company.name }}
                    </p>
                    <a
                      v-if="company.website"
                      :href="company.website"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="cursor-pointer text-xs text-violet-600 hover:underline dark:text-violet-400"
                    >
                      <FontAwesomeIcon icon="arrow-up-right-from-square" class="text-[10px]" />
                    </a>
                  </div>
                  <p
                    v-if="company.financials?.ticker"
                    class="mt-0.5 font-mono text-[11px] text-gray-500 dark:text-gray-400"
                  >
                    {{ company.financials.ticker }}
                  </p>
                </div>
                <div v-if="company.financials" class="flex flex-wrap justify-end gap-1.5">
                  <span
                    class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    :class="stageBadge(company.financials.stage)"
                  >
                    {{ t(`mineralsCountry.financials.stages.${company.financials.stage}`) }}
                  </span>
                  <span
                    class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    :class="riskBadge(company.financials.riskLevel)"
                  >
                    {{ t('mineralsCountry.financials.risk') }}: {{ t(`mineralsCountry.financials.risks.${company.financials.riskLevel}`) }}
                  </span>
                </div>
              </div>

              <!-- Description -->
              <p class="text-xs text-gray-600 dark:text-gray-300">
                {{ t(company.descriptionKey) }}
              </p>

              <!-- Financials block -->
              <div v-if="company.financials" class="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <!-- Stats grid -->
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <p class="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {{ t('mineralsCountry.financials.profitability') }}
                    </p>
                    <p class="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {{ t(`mineralsCountry.financials.profits.${profitabilityKey(company.financials.profitability)}`) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {{ t('mineralsCountry.financials.dividend') }}
                    </p>
                    <p class="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {{ t(`mineralsCountry.financials.dividends.${company.financials.dividend}`) }}
                    </p>
                  </div>
                  <div v-if="company.financials.mineLife">
                    <p class="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {{ t('mineralsCountry.financials.mineLife') }}
                    </p>
                    <p class="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {{ company.financials.mineLife }}
                    </p>
                  </div>
                </div>

                <!-- Financial perf -->
                <div
                  v-if="company.financials.revenueGrowthYoY || company.financials.netIncome"
                  class="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3 text-xs dark:border-gray-700"
                >
                  <div v-if="company.financials.revenueGrowthYoY" class="flex items-center gap-1.5">
                    <FontAwesomeIcon icon="arrow-trend-up" class="text-emerald-500" />
                    <span class="text-gray-500 dark:text-gray-400">{{ t('mineralsCountry.financials.revenueYoY') }}:</span>
                    <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ company.financials.revenueGrowthYoY }}</span>
                  </div>
                  <div v-if="company.financials.netIncome" class="flex items-center gap-1.5">
                    <FontAwesomeIcon icon="coins" class="text-violet-500" />
                    <span class="text-gray-500 dark:text-gray-400">{{ t('mineralsCountry.financials.netIncome') }}:</span>
                    <span class="font-semibold text-gray-900 dark:text-white">{{ company.financials.netIncome }}</span>
                  </div>
                </div>

                <!-- Catalyst -->
                <div v-if="company.financials.catalystKey" class="border-t border-gray-200 pt-3 dark:border-gray-700">
                  <p class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    <FontAwesomeIcon icon="bullseye" class="text-violet-500" />
                    {{ t('mineralsCountry.financials.primaryCatalyst') }}
                  </p>
                  <p class="mt-1 text-xs text-gray-700 dark:text-gray-200">
                    {{ t(company.financials.catalystKey) }}
                  </p>
                </div>

                <!-- Contracts -->
                <div v-if="company.financials.contractsKey" class="border-t border-gray-200 pt-3 dark:border-gray-700">
                  <p class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    <FontAwesomeIcon icon="handshake" class="text-violet-500" />
                    {{ t('mineralsCountry.financials.contracts') }}
                  </p>
                  <p class="mt-1 text-xs text-gray-700 dark:text-gray-200">
                    {{ t(company.financials.contractsKey) }}
                  </p>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
