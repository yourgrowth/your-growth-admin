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

export async function flagMeal(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('meal_suggestions').update({ flagged: true }).eq('id', id)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'flag_meal',
    target_user_id: null,
    metadata: { meal_id: id },
  })
  revalidatePath('/nutrition')
}

export async function unflagMeal(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('meal_suggestions').update({ flagged: false }).eq('id', id)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'unflag_meal',
    target_user_id: null,
    metadata: { meal_id: id },
  })
  revalidatePath('/nutrition')
}

export async function deleteMeal(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('meal_suggestions').delete().eq('id', id)
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'delete_meal',
    target_user_id: null,
    metadata: { meal_id: id },
  })
  revalidatePath('/nutrition')
}
