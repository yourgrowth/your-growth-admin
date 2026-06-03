import { createClient } from '@/lib/supabase/server'
import { getAdminSessions, getLoginAttempts } from '@/app/actions/security'
import SecurityClient from './SecurityClient'

export default async function SecurityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [sessions, attempts] = await Promise.all([
    getAdminSessions(),
    getLoginAttempts(),
  ])

  return <SecurityClient userId={user?.id ?? ''} sessions={sessions} attempts={attempts} />
}
