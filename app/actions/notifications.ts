'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function sendNotification(title: string, body: string, segment: string) {
  const admin = createAdminClient()
  await admin.from('notifications_log').insert({
    title,
    body,
    segment,
    sent_at: new Date().toISOString(),
    open_count: 0,
  })
  revalidatePath('/notifications')
}
