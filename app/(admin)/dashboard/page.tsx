import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalUsers },
    { count: proUsers },
    { count: flaggedGardener },
    { count: flaggedMeals },
    { count: publishedContent },
    { data: recentUsers },
    { data: allProfiles },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'Pro'),
    supabase.from('gardener_summaries').select('*', { count: 'exact', head: true }).eq('flagged', true),
    supabase.from('meal_suggestions').select('*', { count: 'exact', head: true }).eq('flagged', true),
    supabase.from('growth_bible_videos').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('profiles').select('id, full_name, stage, plan, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('profiles').select('stage'),
  ])

  const flaggedItems = (flaggedGardener ?? 0) + (flaggedMeals ?? 0)

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

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={totalUsers ?? 0} color="#e6edf3" />
        <StatCard label="Pro Subscribers" value={proUsers ?? 0} color="#bc8cff" />
        <StatCard label="Published Content" value={publishedContent ?? 0} color="#58a6ff" />
        <StatCard label="Flagged Items" value={flaggedItems} color="#f85149" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
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
                  <td className="px-4 py-2.5" style={{ color: '#e6edf3' }}>{u.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{u.stage ?? '—'}</td>
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

      <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
          System Health
        </p>
        <div className="grid grid-cols-4 gap-4">
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
    </div>
  )
}
