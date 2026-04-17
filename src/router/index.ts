import { createRouter, createWebHistory } from 'vue-router'
import { dashboardRoutes } from '@/modules/dashboard/dashboard.routes'
import { interestRateRoutes } from '@/modules/interest-rate/interest-rate.routes'
import { inflationRoutes } from '@/modules/inflation/inflation.routes'
import { dividendsRoutes } from '@/modules/dividends/dividends.routes'
import { aiRecommendationRoutes } from '@/modules/ai-recommendation/ai-recommendation.routes'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...dashboardRoutes, ...interestRateRoutes, ...inflationRoutes, ...dividendsRoutes, ...aiRecommendationRoutes],
})
