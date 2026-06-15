import {
  getOverviewStats,
  getScraperRuns,
  getBrands,
  queryProducts,
} from '@/app/actions/foodDatabase'
import FoodDatabaseClient from './FoodDatabaseClient'

export default async function FoodDatabasePage() {
  const [stats, runs, brands, initialProducts] = await Promise.all([
    getOverviewStats(),
    getScraperRuns(10),
    getBrands(),
    queryProducts({ status: 'all', sortKey: 'created_at', sortDir: 'desc' }, 1, 50),
  ])

  return (
    <FoodDatabaseClient
      initialStats={stats}
      initialRuns={runs}
      brands={brands}
      initialProducts={initialProducts}
    />
  )
}
