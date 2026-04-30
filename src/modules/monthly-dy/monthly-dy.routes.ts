import type { RouteRecordRaw } from 'vue-router'

export const monthlyDyRoutes: RouteRecordRaw[] = [
  {
    path: '/monthly-dy',
    name: 'monthly-dy',
    component: () => import('./monthly-dy.vue'),
  },
  {
    path: '/monthly-dy/:ticker',
    name: 'monthly-dy-detail',
    component: () => import('./monthly-dy-detail.vue'),
  },
]
