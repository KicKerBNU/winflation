import type { RouteRecordRaw } from 'vue-router'

export const interestRateRoutes: RouteRecordRaw[] = [
  {
    path: '/interest-rate',
    name: 'interest-rate',
    component: () => import('./interest-rate.vue'),
  },
]
