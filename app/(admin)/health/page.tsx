import { getHealthStats, getEdgeFunctionStats, getActiveIncidents } from '@/app/actions/health'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import HealthClient from './HealthClient'

export default async function HealthPage() {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    stats, edgeStats, incidents, safetyFlagsResult, chatCountResult,
    supabaseCheckResult, anthropicRecentResult, revCatRecentResult,
    muxRecentResult, pushRecentResult,
  ] = await Promise.all([
    getHealthStats(),
    getEdgeFunctionStats(),
    getActiveIncidents(),
    Promise.resolve(admin.from('safety_flag_log').select('id, user_id, layer_caught, trigger_type, input_snippet, response_given, created_at').order('created_at', { ascending: false }).limit(100)).catch(() => ({ data: null })),
    Promise.resolve(admin.from('gardener_chat_sessions').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo)).catch(() => ({ count: 0 })),
    // Proxy: Supabase — can we query profiles?
    Promise.resolve(admin.from('profiles').select('id').limit(1)).catch(() => ({ data: null, error: true })),
    // Proxy: Anthropic — last ai_usage_log row
    Promise.resolve(admin.from('ai_usage_log').select('created_at').order('created_at', { ascending: false }).limit(1)).catch(() => ({ data: null })),
    // Proxy: RevenueCat — any paid plan update in last 24h
    Promise.resolve(admin.from('profiles').select('id').neq('subscription_status', 'free').gte('updated_at', oneDayAgo).limit(1)).catch(() => ({ data: null })),
    // Proxy: Mux — any video watch event in last 1h
    Promise.resolve(admin.from('video_watch_events').select('id').gte('created_at', oneHourAgo).limit(1)).catch(() => ({ data: null })),
    // Proxy: Expo Push — any notification sent in last 24h
    Promise.resolve(admin.from('notifications_log').select('id').gte('created_at', oneDayAgo).limit(1)).catch(() => ({ data: null })),
  ])

  type RawFlag = { id: string; user_id: string | null; layer_caught: string | null; trigger_type: string | null; input_snippet: string | null; response_given: string | null; created_at: string }
  const safetyFlags = ((safetyFlagsResult as { data: RawFlag[] | null }).data ?? [])

  const totalFlags = safetyFlags.length
  const crisisTotal = safetyFlags.filter((f) => f.layer_caught === 'crisis').length
  const rateLimitTotal = safetyFlags.filter((f) => f.layer_caught === 'rate_limit').length
  const totalChats = (chatCountResult as { count: number | null }).count ?? 0
  const flagRate = totalChats > 0 ? Math.round((totalFlags / totalChats) * 100) : 0

  // Country list — join with profiles for country_code
  const { data: rawProfilesData } = await Promise.resolve(admin
    .from('profiles')
    .select('country_code')).catch(() => ({ data: null }))

  const profilesData = rawProfilesData as unknown as Array<{ country_code: string | null }> | null

  const countryMap = new Map<string, number>()
  for (const p of profilesData ?? []) {
    const cc = p.country_code ?? 'Unknown'
    countryMap.set(cc, (countryMap.get(cc) ?? 0) + 1)
  }
  const countryList = Array.from(countryMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([country, count]) => ({ country, count }))

  // Proxy status checks
  type ProxyStatus = 'operational' | 'unknown' | 'degraded'
  const supabaseOk = !!(supabaseCheckResult as { data: unknown; error?: unknown }).data
  const anthropicRows = (anthropicRecentResult as { data: { created_at: string }[] | null }).data ?? []
  const anthropicLastAt = anthropicRows[0]?.created_at
  const anthropicStatus: ProxyStatus = !anthropicLastAt
    ? 'unknown'
    : anthropicLastAt >= tenMinAgo
    ? 'operational'
    : anthropicLastAt >= oneHourAgo
    ? 'unknown'
    : 'degraded'

  const revCatRows = (revCatRecentResult as { data: unknown[] | null }).data ?? []
  const muxRows = (muxRecentResult as { data: unknown[] | null }).data ?? []
  const pushRows = (pushRecentResult as { data: unknown[] | null }).data ?? []

  const proxyStatus: Record<string, ProxyStatus> = {
    Supabase: supabaseOk ? 'operational' : 'degraded',
    'Anthropic API': anthropicStatus,
    RevenueCat: revCatRows.length > 0 ? 'operational' : 'unknown',
    Mux: muxRows.length > 0 ? 'operational' : 'unknown',
    'Expo Push': pushRows.length > 0 ? 'operational' : 'unknown',
  }

  return (
    <div>
      <PageHeader title="App Health" subtitle="Real-time error tracking and system status" />
      <HealthClient
        stats={stats}
        edgeStats={edgeStats}
        incidents={incidents}
        safetyFlags={safetyFlags}
        safetyStats={{ total: totalFlags, crisisTotal, rateLimitTotal, flagRate }}
        countryList={countryList}
        proxyStatus={proxyStatus}
      />
    </div>
  )
}
