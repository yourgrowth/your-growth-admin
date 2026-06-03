import { createClient } from '@/lib/supabase/server'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: history } = await supabase
    .from('notifications_log')
    .select('*')
    .order('sent_at', { ascending: false })

  return <NotificationsClient history={history ?? []} />
}
