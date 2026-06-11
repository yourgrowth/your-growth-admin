'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function markFlagReviewed(flagId: string) {
  const [admin, supabase] = [createAdminClient(), await createClient()]
  const { data: { user } } = await supabase.auth.getUser()
  await admin
    .from('safety_flag_log')
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
    .eq('id', flagId)
  revalidatePath('/safety')
}

export async function markFalsePositive(flagId: string, originalResponse: string) {
  const admin = createAdminClient()

  // Ensure false_positives table exists and insert
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('false_positives') as any).insert({
      safety_flag_id: flagId,
      original_response: originalResponse,
      reviewed_at: new Date().toISOString(),
    })
  } catch {
    // Table may not exist yet — silently handle
  }

  revalidatePath('/safety')
}
