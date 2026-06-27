'use server'

import { createClient } from '@/lib/supabase/server'
import { genericAdmin } from '@/lib/supabase/generic'

/**
 * Shared admin guards + audit logging for every server action in the panel.
 * Mirrors the inline helpers in `foodDatabase.ts` so new sections stay
 * consistent (admin-only, every mutation written to `admin_audit_log`).
 */

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return user.id
}

export async function audit(
  adminId: string,
  action: string,
  metadata: Record<string, unknown>,
  targetUserId: string | null = null,
): Promise<void> {
  try {
    const admin = genericAdmin()
    await admin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId,
      metadata,
    })
  } catch {
    // audit logging is best-effort — never block the mutation on it
  }
}
