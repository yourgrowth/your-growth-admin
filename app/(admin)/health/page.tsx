import { getHealthStats, getEdgeFunctionStats, getActiveIncidents } from '@/app/actions/health'
import PageHeader from '@/components/ui/PageHeader'
import HealthClient from './HealthClient'

export default async function HealthPage() {
  const [stats, edgeStats, incidents] = await Promise.all([
    getHealthStats(),
    getEdgeFunctionStats(),
    getActiveIncidents(),
  ])

  return (
    <div>
      <PageHeader title="App Health" subtitle="Real-time error tracking and system status" />
      <HealthClient stats={stats} edgeStats={edgeStats} incidents={incidents} />
    </div>
  )
}
