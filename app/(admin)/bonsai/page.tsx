import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'

const STAGE_NAMES: Record<number, string> = {
  1: 'Seed',
  2: 'Sprout',
  3: 'Sapling',
  4: 'Young Tree',
  5: 'Established',
  6: 'Maturing',
  7: 'Seasoned',
  8: 'Ancient',
}

const STAGE_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 350,
  4: 900,
  5: 2000,
  6: 4000,
  7: 7500,
  8: 13000,
}

type BonsaiProfile = {
  id: string
  full_name: string | null
  stage: number | null
  total_points: number | null
  plan: string | null
  last_sign_in_at: string | null
  created_at: string
}

export default async function BonsaiPage() {
  const supabase = createAdminClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const [rawProfilesResult, recentResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, stage, total_points, plan, last_sign_in_at, created_at'),
    supabase.from('profiles').select('id, stage').gte('created_at', thirtyDaysAgo),
  ])

  const allProfiles = (rawProfilesResult.data ?? []) as unknown as BonsaiProfile[]
  const recentProfiles = (recentResult.data ?? []) as unknown as Array<{ id: string; stage: number | null }>

  const profiles = allProfiles ?? []
  const total = profiles.length

  // Stage distribution
  const stageMap: Record<number, number> = {}
  for (const p of profiles) {
    const s = Number(p.stage ?? 1)
    stageMap[s] = (stageMap[s] ?? 0) + 1
  }

  // Points health
  const active = profiles.filter(
    (p) => p.last_sign_in_at && new Date(p.last_sign_in_at) >= new Date(thirtyDaysAgo)
  )
  const avgDailyPoints =
    active.length > 0
      ? Math.round(active.reduce((s, p) => s + ((p.total_points ?? 0) / 30), 0) / active.length)
      : 0
  const capHitters = active.filter((p) => ((p.total_points ?? 0) / 30) >= 90).length
  const capPct = active.length > 0 ? Math.round((capHitters / active.length) * 100) : 0

  // At-risk: active subscription but no points in 5+ days
  const atRisk = profiles.filter(
    (p) =>
      p.plan?.toLowerCase() === 'pro' &&
      (!p.last_sign_in_at || new Date(p.last_sign_in_at) < new Date(fiveDaysAgo))
  )

  // Stage advancement this month
  const previousMonthStages: Record<string, number> = {}
  for (const p of recentProfiles ?? []) {
    previousMonthStages[p.id] = Number(p.stage ?? 1)
  }
  const advancedThisMonth = (recentProfiles ?? []).filter((p) => {
    const current = profiles.find((pr) => pr.id === p.id)
    return current && Number(current.stage ?? 1) > Number(p.stage ?? 1)
  }).length

  // Retention signal: avg days retained per stage
  const stageRetentionMap: Record<number, number[]> = {}
  for (const p of profiles) {
    if (!p.created_at) continue
    const s = Number(p.stage ?? 1)
    const days = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
    if (!stageRetentionMap[s]) stageRetentionMap[s] = []
    stageRetentionMap[s].push(days)
  }

  const stageAvgDays = Object.entries(stageRetentionMap).map(([stage, daysList]) => ({
    stage: Number(stage),
    avgDays: Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length),
    count: daysList.length,
  })).sort((a, b) => a.stage - b.stage)

  const lowStageChurn = profiles.filter((p) => {
    const s = Number(p.stage ?? 1)
    if (s > 2) return false
    const days = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
    return days > 14 && (!p.last_sign_in_at || new Date(p.last_sign_in_at) < new Date(sevenDaysAgo))
  }).length

  const highStageActive = profiles.filter((p) => {
    const s = Number(p.stage ?? 1)
    if (s < 5) return false
    return p.last_sign_in_at && new Date(p.last_sign_in_at) >= new Date(sevenDaysAgo)
  }).length
  const highStageTotal = profiles.filter((p) => Number(p.stage ?? 1) >= 5).length
  const highStageChurnRate =
    highStageTotal > 0 ? Math.round(((highStageTotal - highStageActive) / highStageTotal) * 100) : 0
  const lowStageTotal = profiles.filter((p) => Number(p.stage ?? 1) <= 2).length
  const lowStageChurnRate = lowStageTotal > 0 ? Math.round((lowStageChurn / lowStageTotal) * 100) : 0

  return (
    <div>
      <PageHeader title="Bonsai" subtitle="Points, stages, and tree health across all users" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={total} color="#e6edf3" />
        <StatCard label="Avg Daily Points (Active)" value={avgDailyPoints} color="#3fb950" />
        <StatCard label="At Daily Cap %" value={`${capPct}%`} color="#d29922" />
        <StatCard label="At-Risk (Pro, 5d inactive)" value={atRisk.length} color="#f85149" />
      </div>

      {/* Stage Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
              Stage Distribution
            </p>
            <span className="text-xs" style={{ color: '#7d8fa3' }}>{advancedThisMonth} advanced this month</span>
          </div>
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((stage) => {
              const count = stageMap[stage] ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const threshold = STAGE_THRESHOLDS[stage]
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: '#e6edf3' }}>
                      Stage {stage} â€” {STAGE_NAMES[stage]}
                      <span className="ml-2 font-mono" style={{ color: '#7d8fa3' }}>
                        {threshold.toLocaleString()} pts
                      </span>
                    </span>
                    <span style={{ color: '#7d8fa3' }}>
                      {count} Â· {pct}%
                    </span>
                  </div>
                  <ProgressBar value={pct} color={stage >= 6 ? '#bc8cff' : stage >= 4 ? '#58a6ff' : '#3fb950'} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Points Health */}
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
            Points Health
          </p>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg p-4" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Avg daily points (active 30d)</p>
              <p className="text-2xl font-bold" style={{ color: '#3fb950' }}>{avgDailyPoints}</p>
              <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>cap = 100 pts/day</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Hitting daily cap (â‰¥90 pts/day avg)</p>
              <p className="text-2xl font-bold" style={{ color: '#d29922' }}>{capPct}%</p>
              <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>{capHitters} of {active.length} active users</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#080b0f', border: '1px solid #f85149' }}>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>At-risk Pro users</p>
              <p className="text-2xl font-bold" style={{ color: '#f85149' }}>{atRisk.length}</p>
              <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>Pro plan, no activity in 5+ days â†’ decay approaching</p>
            </div>
          </div>
        </div>
      </div>

      {/* At-risk table */}
      {atRisk.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-8" style={{ border: '1px solid #f85149' }}>
          <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #f85149' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f85149' }}>
              At-Risk Pro Users â€” Points Decay Approaching
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                {['User', 'Stage', 'Total Points', 'Last Active', 'Days Inactive'].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {atRisk.map((u, i) => {
                const daysInactive = u.last_sign_in_at
                  ? Math.floor((Date.now() - new Date(u.last_sign_in_at).getTime()) / 86400000)
                  : null
                return (
                  <tr key={u.id} style={{ background: '#080b0f', borderBottom: i < atRisk.length - 1 ? '1px solid #1a2332' : undefined }}>
                    <td className="px-4 py-2.5" style={{ color: '#e6edf3' }}>{u.full_name ?? 'â€”'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                      Stage {u.stage ?? 1} â€” {STAGE_NAMES[Number(u.stage ?? 1)]}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#3fb950' }}>
                      {(u.total_points ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: daysInactive && daysInactive >= 7 ? '#f85149' : '#d29922' }}>
                      {daysInactive ?? 'â€”'}d
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Retention Signal */}
      <div className="rounded-lg p-5 mb-8" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
          Retention Signal â€” Avg Days Retained per Stage
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg p-4" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Stage 1â€“2 churn rate (inactive &gt;7d after 14d)</p>
            <p className="text-2xl font-bold" style={{ color: lowStageChurnRate > 50 ? '#f85149' : '#d29922' }}>
              {lowStageChurnRate}%
            </p>
            <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>{lowStageChurn} of {lowStageTotal} early-stage users</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Stage 5+ churn rate (inactive &gt;7d)</p>
            <p className="text-2xl font-bold" style={{ color: highStageChurnRate > 20 ? '#d29922' : '#3fb950' }}>
              {highStageChurnRate}%
            </p>
            <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>{highStageTotal - highStageActive} of {highStageTotal} high-stage users inactive</p>
          </div>
        </div>

        {stageAvgDays.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#080b0f', borderBottom: '1px solid #1a2332' }}>
                {['Stage', 'Name', 'Users', 'Avg Days Retained'].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stageAvgDays.map((row, i) => (
                <tr key={row.stage} style={{ background: '#080b0f', borderBottom: i < stageAvgDays.length - 1 ? '1px solid #1a2332' : undefined }}>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#7d8fa3' }}>{row.stage}</td>
                  <td className="px-4 py-2.5" style={{ color: '#e6edf3' }}>{STAGE_NAMES[row.stage]}</td>
                  <td className="px-4 py-2.5" style={{ color: '#7d8fa3' }}>{row.count}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: row.avgDays > 60 ? '#3fb950' : row.avgDays > 30 ? '#d29922' : '#7d8fa3' }}>
                    {row.avgDays}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs" style={{ color: '#7d8fa3' }}>No retention data yet</p>
        )}
      </div>
    </div>
  )
}

