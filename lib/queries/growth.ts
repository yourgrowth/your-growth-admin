import { createAdminClient } from '@/lib/supabase/admin'

export interface GrowthProfile {
  id: string
  username: string | null
  plan: string | null
  full_name: string | null
  streak: number | null
  ai_calls_used_this_month: number | null
  created_at: string
  last_active_at: string | null
}

export interface RevenueSignals {
  totalUsers: number
  paidUsers: number
  newPaid30d: number
  totalApiCalls: number
  churnHighRiskCount: number
}

export async function getUpgradeCandidates(): Promise<GrowthProfile[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, username, plan, full_name, streak, ai_calls_used_this_month, created_at, last_active_at')
    .eq('plan', 'free')
    .order('streak', { ascending: false })
    .limit(50)
  return (data ?? []) as GrowthProfile[]
}

export async function getChurnRisks(): Promise<GrowthProfile[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, username, plan, full_name, streak, last_active_at, ai_calls_used_this_month')
    .eq('plan', 'pro')
    .order('last_active_at', { ascending: true })
    .limit(50)
  return (data ?? []) as GrowthProfile[]
}

export async function getRevenueSignals(): Promise<RevenueSignals> {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: paidUsers },
    { count: newPaid },
    { data: allProfiles },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'pro')
      .gte('created_at', thirtyDaysAgo),
    admin.from('profiles').select('ai_calls_used_this_month, plan, last_active_at, streak'),
  ])

  const all = allProfiles ?? []
  const totalApiCalls = all.reduce((sum, p) => sum + (p.ai_calls_used_this_month ?? 0), 0)

  const churnHighRiskCount = all.filter((p) => {
    if (!p.plan || p.plan === 'free') return false
    const lastActiveDays = p.last_active_at
      ? Math.floor((Date.now() - new Date(p.last_active_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const score = Math.min(100, lastActiveDays * 0.5 + (p.streak === 0 ? 30 : 0))
    return score > 70
  }).length

  return {
    totalUsers: totalUsers ?? 0,
    paidUsers: paidUsers ?? 0,
    newPaid30d: newPaid ?? 0,
    totalApiCalls,
    churnHighRiskCount,
  }
}
