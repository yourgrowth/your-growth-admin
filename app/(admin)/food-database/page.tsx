import {
  getOverviewStats,
  getScraperRuns,
  getBrands,
  queryProducts,
  getPendingSubmissionCount,
} from '@/app/actions/foodDatabase'
import FoodDatabaseClient from './FoodDatabaseClient'

export default async function FoodDatabasePage() {
  const [stats, runs, brands, initialProducts, pendingSubmissions] = await Promise.all([
    getOverviewStats(),
    getScraperRuns(10),
    getBrands(),
    queryProducts({ status: 'all', sortKey: 'created_at', sortDir: 'desc' }, 1, 50),
    getPendingSubmissionCount(),
  ])

  return (
    <FoodDatabaseClient
      initialStats={stats}
      initialRuns={runs}
      brands={brands}
      initialProducts={initialProducts}
      pendingSubmissions={pendingSubmissions}
    />
  )
}
