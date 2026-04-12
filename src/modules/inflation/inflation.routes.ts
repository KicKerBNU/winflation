import type { RouteRecordRaw } from 'vue-router'

export const inflationRoutes: RouteRecordRaw[] = [
  {
    path: '/inflation',
    name: 'inflation',
    component: () => import('./inflation.vue'),
  },
  {
    path: '/inflation/:countryCode',
    name: 'inflation-country',
    component: () => import('./inflation-country.vue'),
  },
]
