import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: proUsers },
    { count: flaggedGardener },
    { count: flaggedMeals },
    { count: publishedContent },
    { data: recentUsers },
    { data: allProfiles },
    chatsTodayResult,
    safetyFlagsTodayResult,
    crisisTodayResult,
    contextSnapshotsResult,
    returningUsersResult,
    dataConfidenceResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'Pro'),
    supabase.from('gardener_summaries').select('*', { count: 'exact', head: true }).eq('flagged', true),
    supabase.from('meal_suggestions').select('*', { count: 'exact', head: true }).eq('flagged', true),
    supabase.from('growth_bible_videos').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('profiles').select('id, full_name, stage, plan, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('stage'),
    Promise.resolve(admin.from('gardener_chat_sessions').select('*', { count: 'exact', head: true }).gte('created_at', todayISO)).catch(() => ({ count: 0 })),
    Promise.resolve(admin.from('safety_flag_log').select('*', { count: 'exact', head: true }).gte('created_at', todayISO)).catch(() => ({ count: 0 })),
    Promise.resolve(admin.from('safety_flag_log').select('*', { count: 'exact', head: true }).eq('layer_caught', 'crisis').gte('created_at', oneDayAgo)).catch(() => ({ count: 0 })),
    Promise.resolve(admin.from('gardener_context_snapshots').select('*', { count: 'exact', head: true }).gte('generated_at', oneDayAgo)).catch(() => ({ count: 0 })),
    Promise.resolve(admin.from('user_models').select('*', { count: 'exact', head: true }).eq('currently_returning', true)).catch(() => ({ count: 0 })),
    Promise.resolve(admin.from('gardener_context_snapshots').select('data_confidence_score')).catch(() => ({ data: null })),
  ])

  const flaggedItems = (flaggedGardener ?? 0) + (flaggedMeals ?? 0)

  // Derived new metrics
  const chatsToday = (chatsTodayResult as { count: number | null }).count ?? 0
  const safetyFlagsToday = (safetyFlagsTodayResult as { count: number | null }).count ?? 0
  const crisisToday = (crisisTodayResult as { count: number | null }).count ?? 0
  const activeSnapshots = (contextSnapshotsResult as { count: number | null }).count ?? 0
  const returningUsers = (returningUsersResult as { count: number | null }).count ?? 0

  const confidenceScores = ((dataConfidenceResult as { data: { data_confidence_score: number | null }[] | null }).data ?? [])
    .map((r) => r.data_confidence_score ?? 0)
    .filter((v) => v > 0)
  const avgConfidence = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
    : 0

  // Alerts: Pro users with 0 active days in 14 days
  const { data: inactiveProProfiles } = await Promise.resolve(admin
    .from('profiles')
    .select('id, full_name, plan, last_sign_in_at')
    .eq('plan', 'Pro')
    .or(`last_sign_in_at.is.null,last_sign_in_at.lt.${fourteenDaysAgo}`)
    .limit(5)).catch(() => ({ data: [] }))

  const alertInactivePro = (inactiveProProfiles ?? []).length

  const stageMap: Record<string, number> = {}
  ;(allProfiles ?? []).forEach((p) => {
    const s = p.stage ?? 'Unknown'
    stageMap[s] = (stageMap[s] ?? 0) + 1
  })
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1])
  const total = Math.max(totalUsers ?? 1, 1)

  return (
    <div>
      <PageHeader title="Command Centre" subtitle="Overview of your Bonsai app" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Users" value={totalUsers ?? 0} color="#e6edf3" />
        <StatCard label="Pro Subscribers" value={proUsers ?? 0} color="#bc8cff" />
        <StatCard label="Published Content" value={publishedContent ?? 0} color="#58a6ff" />
        <StatCard label="Flagged Items" value={flaggedItems} color="#f85149" />
      </div>

      {/* New stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Gardener Chats Today" value={chatsToday} color="#3fb950" />
        <StatCard
          label="Safety Flags Today"
          value={safetyFlagsToday}
          color={crisisToday > 0 ? '#f85149' : safetyFlagsToday > 0 ? '#d29922' : '#7d8fa3'}
          sub={crisisToday > 0 ? `${crisisToday} crisis` : undefined}
        />
        <StatCard label="Active Snapshots (24h)" value={activeSnapshots} color="#bc8cff" />
        <StatCard label="Returning from Gap" value={returningUsers} color="#58a6ff" />
        <StatCard label="Avg Data Confidence" value={avgConfidence > 0 ? `${avgConfidence}%` : 'â€”'} color="#39d0d8" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
          <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
              Recent Signups
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                {['Name', 'Stage', 'Plan', 'Joined'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#7d8fa3' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentUsers ?? []).map((u, i) => (
                <tr
                  key={u.id}
                  style={{
                    background: '#080b0f',
                    borderBottom: i < (recentUsers?.length ?? 0) - 1 ? '1px solid #1a2332' : undefined,
                  }}
                >
                  <td className="px-4 py-2.5" style={{ color: '#e6edf3' }}>{u.full_name ?? 'â€”'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{u.stage ?? 'â€”'}</td>
                  <td className="px-4 py-2.5">
                    <Badge color={u.plan === 'Pro' ? '#bc8cff' : '#7d8fa3'}>{u.plan ?? 'free'}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(recentUsers ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs" style={{ color: '#7d8fa3', background: '#080b0f' }}>
                    No users yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
            Stage Distribution
          </p>
          <div className="flex flex-col gap-3">
            {stageEntries.length > 0 ? (
              stageEntries.map(([stage, count]) => (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: '#e6edf3' }}>{stage}</span>
                    <span style={{ color: '#7d8fa3' }}>{count}</span>
                  </div>
                  <ProgressBar value={(count / total) * 100} color="#3fb950" />
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: '#7d8fa3' }}>No stage data</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg p-5 mb-6" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
          System Health
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Supabase', 'Edge Functions', 'RevenueCat', 'Mux'].map((service) => (
            <div
              key={service}
              className="flex items-center gap-3 rounded-lg p-4"
              style={{ background: '#080b0f', border: '1px solid #1a2332' }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: '#3fb950', boxShadow: '0 0 6px #3fb950' }}
              />
              <div>
                <p className="text-xs font-medium" style={{ color: '#e6edf3' }}>{service}</p>
                <p className="text-xs" style={{ color: '#3fb950' }}>Operational</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts panel */}
      {(crisisToday > 0 || alertInactivePro > 0) && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #f85149' }}>
          <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #f85149' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f85149' }}>
              Alerts
            </p>
          </div>
          <div className="flex flex-col divide-y" style={{ background: '#080b0f' }}>
            {crisisToday > 0 && (
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1a2332' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#f85149' }}>
                    {crisisToday} crisis event{crisisToday > 1 ? 's' : ''} in the last 24h
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                    Anonymised count only â€” view Safety page for details
                  </p>
                </div>
                <Link
                  href="/safety"
                  className="px-3 py-1.5 rounded text-xs"
                  style={{ background: 'transparent', border: '1px solid #f85149', color: '#f85149' }}
                >
                  View Safety â†’
                </Link>
              </div>
            )}
            {alertInactivePro > 0 && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#d29922' }}>
                    {alertInactivePro} Pro user{alertInactivePro > 1 ? 's' : ''} with 0 activity in 14+ days
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                    Active subscription but not using the app â€” churn risk
                  </p>
                </div>
                <Link
                  href="/subscriptions"
                  className="px-3 py-1.5 rounded text-xs"
                  style={{ background: 'transparent', border: '1px solid #d29922', color: '#d29922' }}
                >
                  View Subscriptions â†’
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

