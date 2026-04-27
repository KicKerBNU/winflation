<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useUserProfileStore } from '@/modules/auth/store/user-profile.store'
import { EU27_COUNTRIES, countryFlag } from './domain/eu-countries'
import {
  WHT_LAST_REVIEWED,
  WHT_SOURCES,
  getWhtForPair,
  type WhtSourceCountry,
} from './domain/withholding-rates'

const { t } = useI18n()
const auth = useAuthStore()
const profile = useUserProfileStore()

const draftTaxCountry = ref<string>('')

watch(
  () => profile.taxCountryCode,
  (next) => {
    draftTaxCountry.value = next ?? ''
  },
  { immediate: true },
)

const dirty = computed(() => (draftTaxCountry.value || null) !== (profile.taxCountryCode ?? null))
const status = ref<'idle' | 'saved' | 'error'>('idle')
const errorDetail = ref<string>('')

async function save() {
  status.value = 'idle'
  errorDetail.value = ''
  try {
    await profile.saveTaxCountry(draftTaxCountry.value || null)
    status.value = 'saved'
    setTimeout(() => {
      if (status.value === 'saved') status.value = 'idle'
    }, 2000)
  } catch (err) {
    status.value = 'error'
    errorDetail.value = err instanceof Error ? err.message : String(err)
    console.error('[settings] Failed to save tax country:', err)
  }
}

function clear() {
  draftTaxCountry.value = ''
}

// ── Withholding-tax matrix ──────────────────────────────────────────────────
const whtSearch = ref<string>('')

const filteredWhtSources = computed<WhtSourceCountry[]>(() => {
  const q = whtSearch.value.trim().toLowerCase()
  const sorted = [...WHT_SOURCES].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) return sorted
  return sorted.filter(
    (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
  )
})

function whtFor(sourceCode: string) {
  if (!profile.taxCountryCode) return null
  return getWhtForPair(sourceCode, profile.taxCountryCode)
}

function fmtPct(rate: number): string {
  // Strip trailing .0 for whole percents; keep up to 3 decimals when needed (DE 26.375%)
  const pct = rate * 100
  return `${parseFloat(pct.toFixed(3))}%`
}

const userCountryName = computed(() => {
  const c = EU27_COUNTRIES.find((c) => c.code === profile.taxCountryCode)
  return c?.name ?? ''
})
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <div class="mx-auto max-w-6xl">
      <header class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
          {{ t('settings.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.subtitle', { name: auth.displayName }) }}
        </p>
      </header>

      <div class="grid gap-6 lg:grid-cols-3 lg:items-start">

      <!-- Tax country section -->
      <section
        class="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-1 lg:sticky lg:top-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('settings.taxCountry.title') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.taxCountry.help') }}
          </p>
        </div>

        <label class="mb-4 block">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ t('settings.taxCountry.label') }}
          </span>
          <select
            v-model="draftTaxCountry"
            class="block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            :title="t('settings.taxCountry.tooltip')"
          >
            <option value="">{{ t('settings.taxCountry.placeholder') }}</option>
            <option v-for="c in EU27_COUNTRIES" :key="c.code" :value="c.code">
              {{ countryFlag(c.code) }} {{ c.name }}
            </option>
          </select>
          <span class="mt-1.5 block text-xs text-gray-400 dark:text-gray-500">
            {{ t('settings.taxCountry.tooltip') }}
          </span>
        </label>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
            :disabled="!dirty || profile.isSaving"
            @click="save"
          >
            <FontAwesomeIcon v-if="profile.isSaving" icon="spinner" class="animate-spin text-xs" />
            {{ t('settings.save') }}
          </button>
          <button
            v-if="draftTaxCountry"
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            @click="clear"
          >
            {{ t('settings.clear') }}
          </button>
          <span
            v-if="status === 'saved'"
            class="text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            <FontAwesomeIcon icon="check" class="mr-1" />
            {{ t('settings.saved') }}
          </span>
          <span
            v-else-if="status === 'error'"
            class="text-xs font-medium text-red-600 dark:text-red-400"
            :title="errorDetail"
          >
            {{ t('settings.error') }}
          </span>
        </div>
        <p
          v-if="status === 'error' && errorDetail"
          class="mt-3 break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
        >
          {{ errorDetail }}
        </p>
      </section>

      <!-- Withholding-tax education hub -->
      <section
        class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2"
      >
        <header class="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('settings.wht.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              <template v-if="profile.hasTaxCountry">
                {{ t('settings.wht.helpForUser', { country: userCountryName }) }}
              </template>
              <template v-else>
                {{ t('settings.wht.helpNoUser') }}
              </template>
            </p>
          </div>
          <span
            v-if="profile.hasTaxCountry"
            class="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-800/40 dark:bg-violet-900/30 dark:text-violet-300"
          >
            <span class="text-base leading-none">{{ countryFlag(profile.taxCountryCode!) }}</span>
            {{ userCountryName }}
          </span>
        </header>

        <!-- Disclaimer banner -->
        <div
          role="note"
          class="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <FontAwesomeIcon icon="triangle-exclamation" class="mt-0.5 flex-shrink-0" />
          <p class="leading-relaxed">{{ t('settings.wht.disclaimer') }}</p>
        </div>

        <template v-if="profile.hasTaxCountry">
          <!-- Search -->
          <label class="mb-4 block">
            <span class="sr-only">{{ t('settings.wht.searchLabel') }}</span>
            <div class="relative">
              <FontAwesomeIcon
                icon="magnifying-glass"
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"
              />
              <input
                v-model="whtSearch"
                type="search"
                :placeholder="t('settings.wht.searchPlaceholder')"
                class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </label>

          <!-- Country list -->
          <div
            v-if="filteredWhtSources.length"
            class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800"
          >
            <!-- Header row (md+ only) -->
            <div
              class="hidden border-b border-gray-200 bg-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 md:grid md:grid-cols-[minmax(180px,1.4fr)_90px_90px_140px_minmax(0,2fr)] md:gap-x-4 md:items-center dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400"
            >
              <span>{{ t('settings.wht.colCountry') }}</span>
              <span class="text-right">{{ t('settings.wht.statutory') }}</span>
              <span class="text-right">{{ t('settings.wht.treaty') }}</span>
              <span>{{ t('settings.wht.colMechanism') }}</span>
              <span>{{ t('settings.wht.colNotes') }}</span>
            </div>

            <ul class="divide-y divide-gray-200 dark:divide-gray-800">
              <li
                v-for="src in filteredWhtSources"
                :key="src.code"
                class="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 md:grid-cols-[minmax(180px,1.4fr)_90px_90px_140px_minmax(0,2fr)] md:items-center"
              >
                <!-- Country -->
                <div class="flex items-center gap-2.5">
                  <span class="text-2xl leading-none">{{ countryFlag(src.code) }}</span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ src.name }}</p>
                    <p class="text-[10px] uppercase tracking-wider text-gray-400">{{ src.code }}</p>
                  </div>
                </div>

                <!-- Statutory -->
                <div class="flex items-baseline gap-1.5 md:justify-end">
                  <span class="text-[10px] uppercase tracking-wider text-gray-400 md:hidden">
                    {{ t('settings.wht.statutory') }}
                  </span>
                  <span class="font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                    {{ fmtPct(whtFor(src.code)!.statutory) }}
                  </span>
                </div>

                <!-- Treaty -->
                <div class="flex items-baseline gap-1.5 md:justify-end">
                  <span class="text-[10px] uppercase tracking-wider text-gray-400 md:hidden">
                    {{ t('settings.wht.treaty') }}
                  </span>
                  <template v-if="whtFor(src.code)!.treaty !== null">
                    <span class="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {{ fmtPct(whtFor(src.code)!.treaty!) }}
                    </span>
                  </template>
                  <span v-else class="font-mono text-sm text-gray-300 dark:text-gray-600">—</span>
                </div>

                <!-- Mechanism (badge) -->
                <div>
                  <span
                    v-if="whtFor(src.code)!.treaty !== null"
                    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    :class="
                      whtFor(src.code)!.reclaimAtSource
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300'
                    "
                  >
                    <FontAwesomeIcon
                      :icon="whtFor(src.code)!.reclaimAtSource ? 'check' : 'triangle-exclamation'"
                      class="text-[8px]"
                    />
                    {{
                      whtFor(src.code)!.reclaimAtSource
                        ? t('settings.wht.appliedAtSource')
                        : t('settings.wht.requiresReclaim')
                    }}
                  </span>
                  <span v-else class="text-[10px] text-gray-400 dark:text-gray-500">
                    {{ t('settings.wht.noTreatyBenefit') }}
                  </span>
                </div>

                <!-- Reclaim note -->
                <p
                  class="text-[11px] leading-snug text-gray-500 dark:text-gray-400"
                  :class="!whtFor(src.code)!.reclaimNote && 'italic text-gray-300 dark:text-gray-600'"
                >
                  {{ whtFor(src.code)!.reclaimNote ?? '—' }}
                </p>
              </li>
            </ul>
          </div>
          <p v-else class="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {{ t('settings.wht.noResults', { query: whtSearch }) }}
          </p>

          <p class="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
            {{ t('settings.wht.reviewedOn', { date: WHT_LAST_REVIEWED }) }}
          </p>
        </template>
        <template v-else>
          <p class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {{ t('settings.wht.setCountryFirst') }}
          </p>
        </template>
      </section>

      </div>
    </div>
  </div>
</template>
