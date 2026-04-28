import type { RouteRecordRaw } from 'vue-router'

export const cashflowRoutes: RouteRecordRaw[] = [
  {
    path: '/cashflow',
    name: 'cashflow',
    component: () => import('./cashflow.vue'),
  },
  {
    path: '/cashflow/:ticker',
    name: 'cashflow-detail',
    component: () => import('./cashflow-detail.vue'),
  },
]
