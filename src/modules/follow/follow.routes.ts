import type { RouteRecordRaw } from 'vue-router'

export const followRoutes: RouteRecordRaw[] = [
  {
    path: '/followed',
    name: 'followed',
    component: () => import('./followed.vue'),
    meta: { requiresAuth: true },
  },
]
