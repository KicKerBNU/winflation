import type { RouteRecordRaw } from 'vue-router'

export const mineralsRoutes: RouteRecordRaw[] = [
  {
    path: '/minerals',
    name: 'minerals',
    component: () => import('./minerals.vue'),
  },
  {
    path: '/minerals/:countryCode',
    name: 'minerals-country',
    component: () => import('./minerals-country.vue'),
  },
]
