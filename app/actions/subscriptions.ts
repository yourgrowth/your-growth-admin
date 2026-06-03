'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function sendReengagement(userId: string, userName: string | null) {
  const admin = createAdminClient()
  await admin.from('notifications_log').insert({
    title: 'We miss you!',
    body: `Hey ${userName ?? 'there'} — come back and keep your streak going!`,
    segment: `user:${userId}`,
    sent_at: new Date().toISOString(),
    open_count: 0,
  })
}
