import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { Profile } from '@/types/database'
import UserDetailClient from './UserDetailClient'

function calcRiskScore(streak: number | null, lastSignIn: string | null, warnings: number | null, plan: string | null) {
  let score = 0
  if ((streak ?? 0) === 0) score += 3
  if (lastSignIn) {
    const d = (Date.now() - new Date(lastSignIn).getTime()) / 86400000
    if (d > 5) score += 2
    if (d > 14) score += 3
  } else { score += 5 }
  score += (warnings ?? 0) * 2
  if ((plan ?? '').toLowerCase() !== 'pro') score += 1
  return score
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [supabase, adminClient] = [await createClient(), createAdminClient()]

  const [{ data: rawProfile }, { data: authUser }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    adminClient.auth.admin.getUserById(id),
  ])

  if (!rawProfile) notFound()

  const profile = rawProfile as Profile
  const auth = authUser?.user
  const last_sign_in_at = auth?.last_sign_in_at ?? profile.last_sign_in_at ?? null

  const user = {
    ...profile,
    email: auth?.email ?? profile.email ?? '',
    last_sign_in_at,
    riskScore: calcRiskScore(profile.streak, last_sign_in_at, profile.warnings, profile.plan),
  }

  return <UserDetailClient user={user} />
}
