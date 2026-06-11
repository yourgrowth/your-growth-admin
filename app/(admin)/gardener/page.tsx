import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import GardenerClient from './GardenerClient'
import { ensureTables } from '@/app/actions/gardener'

export default async function GardenerPage() {
  await ensureTables()

  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: summaries },
    { data: profiles },
    contextSnapshotsResult,
    userModelsResult,
  ] = await Promise.all([
    supabase.from('gardener_summaries').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email'),
    Promise.resolve(admin.from('gardener_context_snapshots').select('*').order('generated_at', { ascending: false })).catch(() => ({ data: null })),
    Promise.resolve(admin.from('user_models').select('*')).catch(() => ({ data: null })),
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
  const emailMap = new Map<string, string>()
  ;(profiles ?? []).forEach((p) => {
    if (p.full_name) nameMap.set(p.id, p.full_name)
    if (p.email) emailMap.set(p.id, p.email)
  })

  const enriched = (summaries ?? []).map((s) => ({
    ...s,
    quality_score: (s as Record<string, unknown>).quality_score as number | null ?? null,
    user_name: nameMap.get(s.user_id) ?? null,
  }))

  const contextSnapshots = ((contextSnapshotsResult as { data: unknown[] | null }).data ?? []) as Record<string, unknown>[]
  const userModels = ((userModelsResult as { data: unknown[] | null }).data ?? []) as Record<string, unknown>[]

  const enrichedSnapshots = contextSnapshots.map((s) => ({
    ...s,
    user_name: nameMap.get(s.user_id as string) ?? null,
    user_email: emailMap.get(s.user_id as string) ?? null,
  }))

  const enrichedModels = userModels.map((m) => ({
    ...m,
    user_name: nameMap.get(m.user_id as string) ?? null,
    user_email: emailMap.get(m.user_id as string) ?? null,
  }))

  return (
    <GardenerClient
      summaries={enriched}
      profiles={profiles ?? []}
      promptVersions={promptVersions}
      contextSnapshots={enrichedSnapshots}
      userModels={enrichedModels}
    />
  )
}
