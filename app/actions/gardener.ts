'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function auditLog(adminId: string, action: string, targetUserId: string) {
  const admin = createAdminClient()
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    metadata: {},
  })
}

// gardener_summaries is a view over daily_summaries — all reads/writes go through it
export async function flagSummary(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  const { data: summary } = await admin
    .from('gardener_summaries')
    .select('user_id')
    .eq('id', id)
    .single()
  await admin.from('gardener_summaries').update({ flagged: true }).eq('id', id)
  if (summary?.user_id) await auditLog(adminId, 'flag_gardener_summary', summary.user_id)
  revalidatePath('/gardener')
}

export async function unflagSummary(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  const { data: summary } = await admin
    .from('gardener_summaries')
    .select('user_id')
    .eq('id', id)
    .single()
  await admin.from('gardener_summaries').update({ flagged: false }).eq('id', id)
  if (summary?.user_id) await auditLog(adminId, 'unflag_gardener_summary', summary.user_id)
  revalidatePath('/gardener')
}

export async function deleteSummary(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  const { data: summary } = await admin
    .from('gardener_summaries')
    .select('user_id')
    .eq('id', id)
    .single()
  await admin.from('gardener_summaries').delete().eq('id', id)
  if (summary?.user_id) await auditLog(adminId, 'delete_gardener_summary', summary.user_id)
  revalidatePath('/gardener')
}

// Tables now exist via migration — this is a no-op kept for backwards compat
export async function ensureTables() {
  // All tables and views created by migration 20260604000001_admin_connectivity_fix.sql
  return
}

export async function testPrompt(promptText: string, userId: string) {
  const admin = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Use completions table (habit_completions is a view over it, both work)
  const [{ data: habitCompletions }, { data: goals }, { data: summaries }] = await Promise.all([
    admin.from('completions').select('*').eq('user_id', userId),
    admin.from('goals').select('*').eq('user_id', userId),
    admin
      .from('gardener_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo)
      .limit(5),
  ])

  const { data, error } = await admin.functions.invoke('gardener-test', {
    body: { prompt: promptText, userId, userData: { habitCompletions, goals, summaries } },
  })

  if (error) throw new Error(error.message)
  return data as { summary: string }
}

export async function savePromptVersion(versionLabel: string, promptText: string) {
  const adminId = await getAdminId()
  if (!adminId) throw new Error('Not authenticated')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('prompt_versions')
    .insert({ version_label: versionLabel, prompt_text: promptText, created_by: adminId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/gardener')
  return data
}

export async function getSummaryForVersion(promptVersion: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('gardener_summaries')
    .select('*')
    .eq('prompt_version', promptVersion)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function setActiveVersion(version: string) {
  const admin = createAdminClient()
  await admin
    .from('prompt_config')
    .upsert({ id: 1, active_version: version, updated_at: new Date().toISOString() })
  revalidatePath('/gardener')
}

export async function updateQualityScore(summaryId: string, score: number) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('gardener_summaries')
    .update({ quality_score: score })
    .eq('id', summaryId)
  if (error) throw new Error(error.message)
  revalidatePath('/gardener')
}
