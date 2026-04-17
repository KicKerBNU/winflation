import type { RouteRecordRaw } from 'vue-router'

export const aiRecommendationRoutes: RouteRecordRaw[] = [
  {
    path: '/ai-recommendation',
    name: 'ai-recommendation',
    component: () => import('./ai-recommendation.vue'),
  },
]
