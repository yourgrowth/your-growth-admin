import { createClient } from '@/lib/supabase/server'
import HabitsClient from './HabitsClient'

export default async function HabitsPage() {
  const supabase = await createClient()

  const [{ data: habits }, { data: profiles }, { data: completions }] = await Promise.all([
    supabase.from('habits').select('id, user_id, name, category, created_at'),
    supabase.from('profiles').select('id, full_name'),
    supabase.from('completions').select('habit_id'),
  ])

  const profileMap = new Map<string, string>()
  ;(profiles ?? []).forEach((p) => {
    profileMap.set(p.id, p.full_name ?? 'Unknown')
  })

  const completionMap = new Map<string, number>()
  ;(completions ?? []).forEach((c) => {
    if (!c.habit_id) return
    completionMap.set(c.habit_id, (completionMap.get(c.habit_id) ?? 0) + 1)
  })

  const rows = (habits ?? [])
    .map((h) => ({
      id: h.id,
      name: h.name,
      user_id: h.user_id,
      user_name: profileMap.get(h.user_id) ?? 'Unknown',
      category: h.category,
      created_at: h.created_at,
      completions: completionMap.get(h.id) ?? 0,
    }))
    .sort((a, b) => b.completions - a.completions)

  const totalCompletions = completions?.length ?? 0

  let mostPopular = '—'
  if (rows.length > 0 && rows[0].completions > 0) {
    mostPopular = rows[0].name
  }

  return (
    <HabitsClient
      habits={rows}
      totalCompletions={totalCompletions}
      mostPopular={mostPopular}
    />
  )
}
