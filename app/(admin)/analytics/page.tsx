import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - day)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: dau },
    { count: wau },
    { count: mau },
    { count: newSignups },
    { count: totalUsers },
    { data: habitUsers },
    { data: goalUsers },
    { data: gardenerUsers },
    { data: nutritionUsers },
    { data: allProfiles },
    { data: cohortRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_sign_in_at', todayStart),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_sign_in_at', sevenDaysAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_sign_in_at', thirtyDaysAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('habits').select('user_id'),
    supabase.from('goals').select('user_id'),
    supabase.from('gardener_summaries').select('user_id'),
    supabase.from('meal_suggestions').select('user_id'),
    supabase.from('profiles').select('stage'),
    supabase.from('profiles').select('id, created_at, last_sign_in_at').gte('created_at', eightWeeksAgo),
  ])

  const total = Math.max(totalUsers ?? 1, 1)

  // Cohort analysis — last 8 signup weeks
  const cohortProfiles = (cohortRaw ?? []) as Array<{
    id: string
    created_at: string
    last_sign_in_at: string | null
  }>
  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const cohortMap = new Map<string, { signups: number; active: number }>()
  for (const p of cohortProfiles) {
    const week = getWeekStart(new Date(p.created_at))
    const entry = cohortMap.get(week) ?? { signups: 0, active: 0 }
    entry.signups++
    if (p.last_sign_in_at && new Date(p.last_sign_in_at) >= thirtyDaysAgoDate) entry.active++
    cohortMap.set(week, entry)
  }
  const cohorts = Array.from({ length: 8 }, (_, i) => {
    const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const week = getWeekStart(weekDate)
    const data = cohortMap.get(week) ?? { signups: 0, active: 0 }
    return { week, ...data }
  })

  const habitCount = new Set((habitUsers ?? []).map((r) => r.user_id)).size
  const goalCount = new Set((goalUsers ?? []).map((r) => r.user_id)).size
  const gardenerCount = new Set((gardenerUsers ?? []).map((r) => r.user_id)).size
  const nutritionCount = new Set((nutritionUsers ?? []).map((r) => r.user_id)).size

  const features = [
    { label: 'Habits', count: habitCount, color: '#3fb950' },
    { label: 'Goals', count: goalCount, color: '#58a6ff' },
    { label: 'Growth Bible', count: gardenerCount, color: '#bc8cff' },
    { label: 'Nutrition', count: nutritionCount, color: '#39d0d8' },
    { label: 'Journal', count: null, color: '#7d8fa3' },
  ]

  const stageMap: Record<string, number> = {}
  ;(allProfiles ?? []).forEach((p) => {
    const s = p.stage ?? 'Unknown'
    stageMap[s] = (stageMap[s] ?? 0) + 1
  })
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Usage and engagement metrics" />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="DAU" value={dau ?? 0} sub="Active today" color="#3fb950" />
        <StatCard label="WAU" value={wau ?? 0} sub="Active this week" color="#58a6ff" />
        <StatCard label="MAU" value={mau ?? 0} sub="Active this month" color="#bc8cff" />
        <StatCard label="New Signups Today" value={newSignups ?? 0} color="#39d0d8" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
            Feature Adoption
          </p>
          <div className="flex flex-col gap-4">
            {features.map(({ label, count, color }) => {
              const pct = count === null ? null : Math.round((count / total) * 100)
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: '#e6edf3' }}>{label}</span>
                    <span style={{ color: '#7d8fa3' }}>
                      {count === null ? 'no data' : `${count} users · ${pct}%`}
                    </span>
                  </div>
                  <ProgressBar value={pct ?? 0} color={color} />
                </div>
              )
            })}
          </div>
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
                    <span style={{ color: '#7d8fa3' }}>
                      {count} · {Math.round((count / total) * 100)}%
                    </span>
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
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
            Retention
          </p>
          <a
            href="https://app.posthog.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
            style={{ color: '#58a6ff' }}
          >
            View in PostHog →
          </a>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {['D1', 'D7', 'D30'].map((label) => (
            <div
              key={label}
              className="rounded-lg p-4 flex flex-col gap-2"
              style={{ background: '#080b0f', border: '1px solid #1a2332' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                {label} Retention
              </p>
              <p className="text-2xl font-bold" style={{ color: '#1a2332' }}>—</p>
              <p className="text-xs" style={{ color: '#7d8fa3' }}>
                Full retention data available in PostHog
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden mt-8" style={{ border: '1px solid #1a2332' }}>
        <div className="px-5 py-4" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
            Cohort Analysis — Last 8 Signup Weeks
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              {['Cohort Week', 'Signups', 'Still Active', 'Retention Rate'].map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#7d8fa3' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => {
              const pct = c.signups > 0 ? Math.round((c.active / c.signups) * 100) : 0
              const pctColor = pct >= 60 ? '#3fb950' : pct >= 30 ? '#d29922' : '#f85149'
              return (
                <tr
                  key={c.week}
                  style={{
                    background: '#080b0f',
                    borderBottom: i < cohorts.length - 1 ? '1px solid #1a2332' : undefined,
                  }}
                >
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: '#e6edf3' }}>
                    {c.week}
                  </td>
                  <td className="px-5 py-3" style={{ color: '#e6edf3' }}>
                    {c.signups}
                  </td>
                  <td className="px-5 py-3" style={{ color: '#58a6ff' }}>
                    {c.active}
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: c.signups > 0 ? pctColor : '#7d8fa3' }}>
                    {c.signups > 0 ? `${pct}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
