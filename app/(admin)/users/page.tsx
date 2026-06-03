import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types/database'
import UsersClient from './UsersClient'

function calcRiskScore(
  streak: number | null,
  lastSignIn: string | null,
  warnings: number | null,
  plan: string | null,
): number {
  let score = 0
  if ((streak ?? 0) === 0) score += 3
  if (lastSignIn) {
    const daysSince = (Date.now() - new Date(lastSignIn).getTime()) / 86400000
    if (daysSince > 5) score += 2
    if (daysSince > 14) score += 3
  } else {
    score += 5
  }
  score += (warnings ?? 0) * 2
  if ((plan ?? '').toLowerCase() !== 'pro') score += 1
  return score
}

export default async function UsersPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const [{ data: rawProfiles }, { data: listData }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const profiles = (rawProfiles ?? []) as Profile[]

  const authMap = new Map<string, { email: string; last_sign_in_at: string | null }>()
  listData?.users?.forEach((u) => {
    authMap.set(u.id, { email: u.email ?? '', last_sign_in_at: u.last_sign_in_at ?? null })
  })

  const users = profiles.map((p) => {
    const auth = authMap.get(p.id)
    const last_sign_in_at = auth?.last_sign_in_at ?? p.last_sign_in_at ?? null
    return {
      ...p,
      email: auth?.email ?? p.email ?? '',
      last_sign_in_at,
      riskScore: calcRiskScore(p.streak, last_sign_in_at, p.warnings, p.plan),
    }
  })

  return <UsersClient users={users} />
}
