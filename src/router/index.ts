import { createRouter, createWebHistory } from 'vue-router'
import { dashboardRoutes } from '@/modules/dashboard/dashboard.routes'
import { interestRateRoutes } from '@/modules/interest-rate/interest-rate.routes'
import { inflationRoutes } from '@/modules/inflation/inflation.routes'
import { dividendsRoutes } from '@/modules/dividends/dividends.routes'
import { aiRecommendationRoutes } from '@/modules/ai-recommendation/ai-recommendation.routes'
import { authRoutes } from '@/modules/auth/auth.routes'
import { followRoutes } from '@/modules/follow/follow.routes'
import { useAuthStore } from '@/modules/auth/store/auth.store'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...dashboardRoutes,
    ...interestRateRoutes,
    ...inflationRoutes,
    ...dividendsRoutes,
    ...aiRecommendationRoutes,
    ...authRoutes,
    ...followRoutes,
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ready
  if (to.meta.guestOnly && auth.isAuthenticated) return { path: '/' }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})
