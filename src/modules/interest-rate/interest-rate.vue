<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInterestRateStore } from './store/interest-rate.store'

const { t } = useI18n()
const store = useInterestRateStore()

onMounted(() => store.init())

const rateLabels: Record<string, string> = {
  deposit: 'interestRate.deposit',
  main: 'interestRate.main',
  marginal: 'interestRate.marginal',
}

const rateColors: Record<string, string> = {
  deposit: 'text-violet-500 dark:text-violet-400',
  main: 'text-cyan-500 dark:text-cyan-400',
  marginal: 'text-amber-500 dark:text-amber-400',
}

const rateBgColors: Record<string, string> = {
  deposit: 'bg-violet-500/10',
  main: 'bg-cyan-500/10',
  marginal: 'bg-amber-500/10',
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('interestRate.title') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('interestRate.subtitle') }}</p>
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading" class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
      <FontAwesomeIcon icon="circle-notch" spin />
      <span class="text-sm">Loading...</span>
    </div>

    <template v-else>
      <!-- Rate cards -->
      <div class="mb-8 grid gap-4 sm:grid-cols-3">
        <div
          v-for="rate in store.rates"
          :key="rate.type"
          class="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900"
        >
          <div
            class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            :class="rateBgColors[rate.type]"
          >
            <FontAwesomeIcon icon="percent" :class="rateColors[rate.type]" />
          </div>
          <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">{{ t(rateLabels[rate.type]) }}</p>
          <p class="text-5xl font-bold" :class="rateColors[rate.type]">
            {{ rate.rate.toFixed(2) }}%
          </p>
          <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
            {{ t('interestRate.effectiveDate') }}: {{ rate.effectiveDate }}
          </p>
        </div>
      </div>

      <!-- Rates table -->
      <div
        class="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th
                class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                {{ t('interestRate.rateType') }}
              </th>
              <th
                class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                {{ t('interestRate.value') }}
              </th>
              <th
                class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                {{ t('interestRate.effectiveDate') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="rate in store.rates"
              :key="rate.type"
              class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                {{ t(rateLabels[rate.type]) }}
              </td>
              <td class="px-6 py-4">
                <span class="text-lg font-bold" :class="rateColors[rate.type]">
                  {{ rate.rate.toFixed(2) }}%
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{{ rate.effectiveDate }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Info card -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-3 flex items-center gap-2">
          <FontAwesomeIcon icon="circle-info" class="text-violet-500 dark:text-violet-400" />
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ t('interestRate.whatAreRates') }}</h3>
        </div>
        <p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {{ t('interestRate.ratesDescription') }}
        </p>
      </div>
    </template>
  </div>
</template>
