import { getMasteryStats, listMasteryUsers } from '@/app/actions/mastery'
import { listResource } from '@/app/actions/resources'
import { getResourceConfig } from '@/lib/admin/resources'
import MasteryClient from './MasteryClient'

export default async function MasteryPage() {
  const pillarsConfig = getResourceConfig('mastery_pillars')!
  const [stats, users, pillars] = await Promise.all([
    getMasteryStats(),
    listMasteryUsers(),
    listResource('mastery_pillars', { page: 1, pageSize: 50, sortKey: 'sort_order', sortDir: 'asc' }),
  ])
  return <MasteryClient stats={stats} users={users} pillarsConfig={pillarsConfig} pillarsInitial={pillars} />
}
