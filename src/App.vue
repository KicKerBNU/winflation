<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useThemeStore } from '@/modules/theme/store/theme.store'

const { t } = useI18n()
const route = useRoute()
const themeStore = useThemeStore()

const navItems = [
  { to: '/', icon: 'gauge-high', labelKey: 'nav.dashboard' },
  { to: '/interest-rate', icon: 'percent', labelKey: 'nav.interestRate' },
  { to: '/inflation', icon: 'arrow-trend-up', labelKey: 'nav.inflation' },
  { to: '/dividends', icon: 'coins', labelKey: 'nav.dividends' },
]
</script>

<template>
  <div class="flex min-h-screen bg-gray-100 transition-colors duration-200 dark:bg-gray-950">
    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-gray-200 bg-white transition-colors duration-200 dark:border-gray-800 dark:bg-gray-900"
    >
      <!-- Logo -->
      <div class="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-800">
        <span class="text-lg font-bold text-violet-600 dark:text-violet-400">winflation</span>
        <span class="text-gray-400 dark:text-gray-500">.eu</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 px-3 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          :class="
            route.path === item.to
              ? 'bg-violet-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
          "
        >
          <FontAwesomeIcon :icon="item.icon" class="w-4" />
          {{ t(item.labelKey) }}
        </RouterLink>
      </nav>

      <!-- Theme toggle + footer -->
      <div class="border-t border-gray-200 px-3 py-4 dark:border-gray-800">
        <button
          class="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          @click="themeStore.toggle()"
        >
          <FontAwesomeIcon :icon="themeStore.isDark ? 'sun' : 'moon'" class="w-4" />
          {{ themeStore.isDark ? 'Light Mode' : 'Dark Mode' }}
        </button>
        <p class="mt-3 px-3 text-xs text-gray-400 dark:text-gray-600">
          Beat inflation, one yield at a time.
        </p>
      </div>
    </aside>

    <!-- Main content -->
    <main class="ml-60 flex-1">
      <RouterView />
    </main>
  </div>
</template>
