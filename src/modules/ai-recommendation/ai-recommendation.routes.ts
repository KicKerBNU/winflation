import type { RouteRecordRaw } from 'vue-router'

export const aiRecommendationRoutes: RouteRecordRaw[] = [
  {
    path: '/ai-recommendation',
    name: 'ai-recommendation',
    component: () => import('./ai-recommendation.vue'),
  },
  {
    path: '/ai-recommendation/:ticker',
    name: 'ai-recommendation-detail',
    component: () => import('./ai-recommendation-detail.vue'),
  },
]
