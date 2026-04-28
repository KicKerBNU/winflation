<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useThemeStore } from '@/modules/theme/store/theme.store'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import UserMenu from '@/modules/auth/components/UserMenu.vue'

const { t } = useI18n()
const route = useRoute()
const themeStore = useThemeStore()
const auth = useAuthStore()

const dashboardItem = { to: '/', icon: 'gauge-high', labelKey: 'nav.dashboard' }

const sharedNavItems = [
  { to: '/inflation', icon: 'arrow-trend-up', labelKey: 'nav.inflation' },
  { to: '/dividends', icon: 'coins', labelKey: 'nav.dividends' },
  { to: '/ai-recommendation', icon: 'robot', labelKey: 'nav.aiRecommendation' },
  { to: '/cashflow', icon: 'calendar', labelKey: 'nav.cashflow' },
  { to: '/minerals', icon: 'gem', labelKey: 'nav.minerals' },
]

const followedItem = { to: '/followed', icon: 'star', labelKey: 'nav.followed' }

const desktopNavItems = computed(() =>
  auth.isAuthenticated
    ? [dashboardItem, ...sharedNavItems, followedItem]
    : [dashboardItem, ...sharedNavItems],
)

const mobileNavItems = computed(() =>
  auth.isAuthenticated ? [...sharedNavItems, followedItem] : sharedNavItems,
)

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

// Auth pages render their own full-screen layout — hide the chrome on /login and /register
const hideChrome = computed(() => ['login', 'register'].includes(route.name as string))
</script>

<template>
  <!-- Auth pages: full-screen layout without sidebar/header -->
  <RouterView v-if="hideChrome" />

  <div v-else class="flex min-h-screen bg-gray-100 transition-colors duration-200 dark:bg-gray-950">

    <!-- Desktop top-right bar (user menu floats above content) -->
    <div class="fixed right-6 top-4 z-30 hidden lg:block">
      <UserMenu />
    </div>

    <!-- Desktop sidebar — hidden on mobile -->
    <aside
      class="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-gray-200 bg-white transition-colors duration-200 dark:border-gray-800 dark:bg-gray-900 lg:flex"
    >
      <!-- Logo -->
      <div class="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-800">
        <span class="text-lg font-bold text-violet-600 dark:text-violet-400">winflation</span>
        <span class="text-gray-400 dark:text-gray-500">.eu</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 px-3 py-4">
        <RouterLink
          v-for="item in desktopNavItems"
          :key="item.to"
          :to="item.to"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          :class="
            isActive(item.to)
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

    <!-- Main content — no left margin on mobile, ml-60 on desktop -->
    <main class="flex min-h-screen w-full flex-col pb-20 lg:ml-60 lg:pb-0">
      <div class="flex-1">
        <RouterView />
      </div>
      <footer
        class="border-t border-gray-200 bg-white px-4 py-6 text-xs leading-relaxed text-gray-500 sm:px-6 lg:px-8 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400"
      >
        <p class="mx-auto max-w-3xl text-center">{{ t('footer.disclaimer') }}</p>
      </footer>
    </main>

    <!-- Mobile top header -->
    <header
      class="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:hidden"
    >
      <span class="text-base font-bold">
        <span class="text-violet-600 dark:text-violet-400">winflation</span>
        <span class="text-gray-400 dark:text-gray-500">.eu</span>
      </span>
      <div class="flex items-center gap-2">
        <button
          class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          @click="themeStore.toggle()"
        >
          <FontAwesomeIcon :icon="themeStore.isDark ? 'sun' : 'moon'" />
        </button>
        <UserMenu />
      </div>
    </header>

    <!-- Mobile bottom nav -->
    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:hidden"
    >
      <div class="flex h-16 items-center justify-around">
        <RouterLink
          v-for="item in mobileNavItems"
          :key="item.to"
          :to="item.to"
          class="flex cursor-pointer flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors"
          :class="
            isActive(item.to)
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-gray-400 dark:text-gray-500'
          "
        >
          <FontAwesomeIcon :icon="item.icon" class="text-lg" />
          <span>{{ t(item.labelKey) }}</span>
        </RouterLink>
      </div>
    </nav>

  </div>
</template>
