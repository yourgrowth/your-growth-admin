import { createClient } from '@/lib/supabase/server'
import GardenerClient from './GardenerClient'
import { ensureTables } from '@/app/actions/gardener'

export default async function GardenerPage() {
  await ensureTables()

  const supabase = await createClient()

  const [{ data: summaries }, { data: profiles }] = await Promise.all([
    supabase.from('gardener_summaries').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name'),
  ])

  let promptVersions: { id: string; version_label: string; prompt_text: string; created_by: string | null; created_at: string }[] = []
  try {
    const { data } = await supabase
      .from('prompt_versions')
      .select('*')
      .order('created_at', { ascending: false })
    promptVersions = data ?? []
  } catch {
    // Table not yet created
  }

  const nameMap = new Map<string, string>()
  ;(profiles ?? []).forEach((p) => {
    if (p.full_name) nameMap.set(p.id, p.full_name)
  })

  const enriched = (summaries ?? []).map((s) => ({
    ...s,
    // quality_score is added via ensureTables; cast needed until types regenerate
    quality_score: (s as Record<string, unknown>).quality_score as number | null ?? null,
    user_name: nameMap.get(s.user_id) ?? null,
  }))

  return (
    <GardenerClient
      summaries={enriched}
      profiles={profiles ?? []}
      promptVersions={promptVersions}
    />
  )
}
