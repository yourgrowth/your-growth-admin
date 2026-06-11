'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function toggleGlobalFlag(id: string, enabled: boolean) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('feature_flags') as any).update({ enabled, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/feature-flags')
}

export async function setUserFlagOverride(userId: string, flagName: string, enabled: boolean) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('user_feature_flags') as any)
    .upsert({ user_id: userId, flag_name: flagName, enabled, created_at: new Date().toISOString() })
  revalidatePath('/feature-flags')
}

export async function deleteUserFlagOverride(id: string) {
  const admin = createAdminClient()
  await admin.from('user_feature_flags').delete().eq('id', id)
  revalidatePath('/feature-flags')
}
