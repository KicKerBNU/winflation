<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.store'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

async function logout() {
  close()
  await auth.signOut()
  router.push('/')
}

function goLogin() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}

function onDocClick(e: MouseEvent) {
  if (!menuRef.value) return
  if (!menuRef.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <!-- Invisible while auth is still bootstrapping to avoid flash -->
  <div v-if="!auth.isInitialized" class="h-9 w-9"></div>

  <!-- Not logged in: Login button -->
  <button
    v-else-if="!auth.isAuthenticated"
    type="button"
    class="flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
    @click="goLogin"
  >
    <FontAwesomeIcon icon="right-to-bracket" class="text-xs" />
    {{ t('auth.menu.login') }}
  </button>

  <!-- Logged in: initials avatar + dropdown -->
  <div v-else ref="menuRef" class="relative">
    <button
      type="button"
      :aria-label="auth.displayName"
      class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white transition-transform hover:scale-105"
      @click.stop="toggle"
    >
      {{ auth.initials }}
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {{ auth.displayName }}
        </p>
        <p v-if="auth.user?.email && auth.user.email !== auth.displayName" class="truncate text-xs text-gray-500 dark:text-gray-400">
          {{ auth.user.email }}
        </p>
      </div>
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        @click="logout"
      >
        <FontAwesomeIcon icon="right-from-bracket" class="text-xs" />
        {{ t('auth.menu.logout') }}
      </button>
    </div>
  </div>
</template>
