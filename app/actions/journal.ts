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

export async function unflagEntry(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('journal_entries').update({ flagged: false }).eq('id', id)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'unflag_journal_entry',
    target_user_id: null,
    metadata: { entry_id: id },
  })
  revalidatePath('/journal')
}

export async function deleteEntry(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('journal_entries').delete().eq('id', id)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'delete_journal_entry',
    target_user_id: null,
    metadata: { entry_id: id },
  })
  revalidatePath('/journal')
}
