<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMineralsStore } from './store/minerals.store'
import { useThemeStore } from '@/modules/theme/store/theme.store'
import { MINERALS_DATA_AS_OF } from './data/minerals.data'
import type { MineralCategory, MineralSymbol } from './domain/minerals.types'

const { t } = useI18n()
const router = useRouter()
const store = useMineralsStore()
const themeStore = useThemeStore()

onMounted(() => store.init())

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let tileLayer: L.TileLayer | null = null
const markers: L.Marker[] = []

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function tileUrl() {
  return themeStore.isDark ? DARK_TILES : LIGHT_TILES
}

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function buildMarkerIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: 'minerals-marker',
    html: `<div class="relative flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-lg ring-4 ring-violet-600/30 transition-transform hover:scale-110">${count}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

function renderMarkers() {
  if (!map) return
  for (const m of markers) m.remove()
  markers.length = 0

  for (const country of store.countries) {
    const marker = L.marker([country.lat, country.lng], {
      icon: buildMarkerIcon(country.minerals.length),
    }).addTo(map)

    const companyList = country.companies
      .map((c) => `<li class="text-xs">${c.name}</li>`)
      .join('')

    const popupHtml = `
      <div class="space-y-2 p-1">
        <div class="flex items-center gap-2">
          <span class="text-xl">${countryFlag(country.countryCode)}</span>
          <span class="text-sm font-bold">${t(country.nameKey)}</span>
        </div>
        <p class="text-xs text-gray-600 dark:text-gray-300">${t(country.statusKey)}</p>
        ${companyList ? `<ul class="space-y-0.5 pl-4 list-disc">${companyList}</ul>` : ''}
        <button data-country="${country.countryCode}" class="minerals-popup-link mt-1 cursor-pointer text-xs font-semibold text-violet-600 hover:underline">
          ${t('minerals.viewCountry')} →
        </button>
      </div>
    `

    marker.bindPopup(popupHtml)
    marker.on('popupopen', () => {
      const btn = document.querySelector<HTMLButtonElement>(
        `.minerals-popup-link[data-country="${country.countryCode}"]`,
      )
      btn?.addEventListener('click', () => {
        router.push(`/minerals/${country.countryCode.toLowerCase()}`)
      })
    })
    markers.push(marker)
  }
}

function initMap() {
  if (!mapEl.value || map) return
  map = L.map(mapEl.value, {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 6,
    worldCopyJump: true,
    scrollWheelZoom: false,
    attributionControl: true,
  })
  tileLayer = L.tileLayer(tileUrl(), {
    attribution: TILE_ATTRIBUTION,
    subdomains: 'abcd',
  }).addTo(map)
  renderMarkers()
}

watch(
  () => store.countries.length,
  async () => {
    await nextTick()
    if (!map) initMap()
    else renderMarkers()
  },
  { immediate: true },
)

watch(
  () => themeStore.isDark,
  () => {
    if (!map || !tileLayer) return
    tileLayer.setUrl(tileUrl())
  },
)

onMounted(async () => {
  await nextTick()
  initMap()
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

const activeCategory = ref<MineralCategory | 'all'>('all')
const categories: Array<MineralCategory | 'all'> = ['all', 'magnet', 'battery', 'other']

const visibleMinerals = computed(() => {
  if (activeCategory.value === 'all') return store.minerals
  return store.minerals.filter((m) => m.category === activeCategory.value)
})

function categoryBadge(category: MineralCategory): string {
  if (category === 'magnet')
    return 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400'
  if (category === 'battery')
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
  return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400'
}

function countriesForMineral(symbol: MineralSymbol): string[] {
  return store.countries.filter((c) => c.minerals.includes(symbol)).map((c) => c.countryCode)
}
</script>

<template>
  <div class="p-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('minerals.title') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('minerals.subtitle') }}</p>
      <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
        {{ t('minerals.dataAsOf', { date: MINERALS_DATA_AS_OF }) }}
      </p>
    </div>

    <!-- Intro / Why invest -->
    <section
      class="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 dark:border-violet-900/30 dark:from-violet-950/30 dark:to-gray-900"
    >
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"
        >
          <FontAwesomeIcon icon="gem" class="text-xl" />
        </div>
        <div class="space-y-2">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('minerals.why.title') }}
          </h2>
          <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {{ t('minerals.why.body') }}
          </p>
        </div>
      </div>
    </section>

    <!-- Price-taker warning callout -->
    <section
      class="mb-6 flex items-start gap-4 rounded-2xl border border-amber-300 bg-amber-50/70 p-5 dark:border-amber-800/40 dark:bg-amber-900/10"
    >
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"
      >
        <FontAwesomeIcon icon="triangle-exclamation" />
      </div>
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {{ t('minerals.warning.title') }}
        </h3>
        <p class="text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
          {{ t('minerals.warning.body') }}
        </p>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="store.isLoading" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
      <FontAwesomeIcon icon="circle-notch" spin class="mr-2" />
      {{ t('minerals.loading') }}
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ store.error }}
    </div>

    <template v-else>
      <!-- Map + Country List -->
      <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Map -->
        <div
          class="relative col-span-1 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:col-span-2"
        >
          <div class="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('minerals.mapTitle') }}
            </h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('minerals.mapHint') }}
            </p>
          </div>
          <div ref="mapEl" class="minerals-map min-h-[480px] w-full flex-1"></div>
        </div>

        <!-- Country list -->
        <div
          class="col-span-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('minerals.countriesTitle') }}
            </h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('minerals.countriesHint') }}
            </p>
          </div>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="country in store.countries"
              :key="country.countryCode"
              class="cursor-pointer px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              @click="router.push(`/minerals/${country.countryCode.toLowerCase()}`)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-3">
                  <span class="text-xl">{{ countryFlag(country.countryCode) }}</span>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ t(country.nameKey) }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ t('minerals.companiesCount', { count: country.companies.length }) }}
                    </p>
                  </div>
                </div>
                <span
                  class="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-600 dark:text-violet-400"
                >
                  {{ country.minerals.length }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Minerals list -->
      <section>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('minerals.mineralsTitle') }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in categories"
              :key="c"
              class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              :class="
                activeCategory === c
                  ? 'bg-violet-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-white'
              "
              @click="activeCategory = c"
            >
              {{ t(`minerals.category.${c}`) }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="mineral in visibleMinerals"
            :key="mineral.symbol"
            class="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-violet-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-600"
          >
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span
                  class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white"
                >
                  {{ mineral.symbol }}
                </span>
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ t(mineral.nameKey) }}
                  </p>
                  <span
                    class="mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                    :class="categoryBadge(mineral.category)"
                  >
                    {{ t(`minerals.category.${mineral.category}`) }}
                  </span>
                </div>
              </div>
            </div>
            <p class="mb-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {{ t(mineral.descriptionKey) }}
            </p>
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
              <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('minerals.usedFor') }}:</span>
              {{ t(mineral.useKey) }}
            </p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="code in countriesForMineral(mineral.symbol)"
                :key="code"
                class="cursor-pointer rounded-md bg-gray-100 px-1.5 py-0.5 text-xs transition-colors hover:bg-violet-100 dark:bg-gray-800 dark:hover:bg-violet-900/40"
                @click="router.push(`/minerals/${code.toLowerCase()}`)"
              >
                {{ countryFlag(code) }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style>
.minerals-map .leaflet-popup-content-wrapper {
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}
.minerals-map .leaflet-popup-content {
  margin: 0;
  padding: 0.75rem;
}
.minerals-map .leaflet-container {
  background: transparent;
}
:global(.dark) .minerals-map .leaflet-popup-content-wrapper,
:global(.dark) .minerals-map .leaflet-popup-tip {
  background: #1f2937;
  color: #e5e7eb;
}
</style>
