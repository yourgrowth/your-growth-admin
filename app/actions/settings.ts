'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function toggleFlag(id: string, enabled: boolean) {
  // Feature flags are admin-only — use admin client
  const admin = createAdminClient()
  await admin.from('feature_flags').update({ enabled }).eq('id', id)
  revalidatePath('/settings')
}

export async function revokeAdmin(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ is_admin: false }).eq('id', userId)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'revoke_admin',
    target_user_id: userId,
    metadata: {},
  })
  revalidatePath('/settings')
}

export async function grantAdmin(email: string): Promise<{ error: string | null }> {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Not authenticated' }
  // Must use admin client — anon key + RLS cannot search other users' profiles
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()
  if (!profile) return { error: 'No user found with that email' }
  await admin.from('profiles').update({ is_admin: true }).eq('id', profile.id)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'grant_admin',
    target_user_id: profile.id,
    metadata: {},
  })
  revalidatePath('/settings')
  return { error: null }
}
