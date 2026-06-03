import { createClient } from '@/lib/supabase/server'
import GoalsClient from './GoalsClient'

export default async function GoalsPage() {
  const supabase = await createClient()

  const [{ data: goals }, { data: profiles }] = await Promise.all([
    supabase
      .from('goals')
      .select('id, user_id, title, category, progress, status, gardener_linked, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name'),
  ])

  const profileMap = new Map<string, string>()
  ;(profiles ?? []).forEach((p) => {
    profileMap.set(p.id, p.full_name ?? 'Unknown')
  })

  const rows = (goals ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    user_id: g.user_id,
    user_name: profileMap.get(g.user_id) ?? 'Unknown',
    category: g.category,
    progress: g.progress,
    status: g.status,
    gardener_linked: g.gardener_linked,
    created_at: g.created_at,
  }))

  const activeCount = rows.filter((g) => g.status?.toLowerCase() !== 'completed').length
  const completedCount = rows.filter((g) => g.status?.toLowerCase() === 'completed').length
  const gardenerCount = rows.filter((g) => g.gardener_linked === true).length

  return (
    <GoalsClient
      goals={rows}
      activeCount={activeCount}
      completedCount={completedCount}
      gardenerCount={gardenerCount}
    />
  )
}
