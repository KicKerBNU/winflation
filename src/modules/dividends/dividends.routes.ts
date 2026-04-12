import type { RouteRecordRaw } from 'vue-router'

export const dividendsRoutes: RouteRecordRaw[] = [
  {
    path: '/dividends',
    name: 'dividends',
    component: () => import('./dividends.vue'),
  },
  {
    path: '/dividends/:ticker',
    name: 'dividend-company',
    component: () => import('./dividend-company.vue'),
  },
]
