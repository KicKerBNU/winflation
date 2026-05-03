import type { RouteRecordRaw } from 'vue-router'

export const quarterlyDyRoutes: RouteRecordRaw[] = [
  {
    path: '/quarterly-dy',
    name: 'quarterly-dy',
    component: () => import('./quarterly-dy.vue'),
  },
  {
    path: '/quarterly-dy/:ticker',
    name: 'quarterly-dy-detail',
    component: () => import('./quarterly-dy-detail.vue'),
  },
]
