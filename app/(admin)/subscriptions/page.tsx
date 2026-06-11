import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import ChurnClient, { type ChurnUser } from './ChurnClient'

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

function fmt(v: number) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function project(mrr: number, rate: number, months: number) {
  return mrr * Math.pow(1 + rate, months)
}

export default async function SubscriptionsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: profiles }, { data: recentCompletions }, trialStartResult, lapsedResult] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase
      .from('completions')
      .select('user_id')
      .gte('completed_at', sevenDaysAgo),
    Promise.resolve(admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo)).catch(() => ({ count: 0 })),
    Promise.resolve(admin.from('profiles').select('id, full_name, plan, last_sign_in_at').eq('plan', 'Pro').lte('last_sign_in_at', sixtyDaysAgo).limit(20)).catch(() => ({ data: null })),
  ])

  const all = profiles ?? []
  const proUsers = all.filter((p) => p.plan?.toLowerCase() === 'pro')
  const freeUsers = all.filter((p) => p.plan?.toLowerCase() !== 'pro')
  const proCount = proUsers.length
  const freeCount = freeUsers.length
  const total = all.length
  const proPct = total > 0 ? ((proCount / total) * 100).toFixed(1) : '0'
  const currentMRR = proCount * 7.99

  const trialSignups = (trialStartResult as { count: number | null }).count ?? 0
  type LapsedUser = { id: string; full_name: string | null; plan: string | null; last_sign_in_at: string | null }
  const lapsedUsers = ((lapsedResult as { data: LapsedUser[] | null }).data ?? [])

  // â”€â”€ Revenue Forecasting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const thisMonth = new Date().toISOString().slice(0, 7)
  const lastMonthDate = new Date()
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1)
  const lastMonth = lastMonthDate.toISOString().slice(0, 7)

  const thisMonthNew = proUsers.filter((p) => p.created_at.startsWith(thisMonth)).length
  const lastMonthNew = proUsers.filter((p) => p.created_at.startsWith(lastMonth)).length
  const growthRate =
    lastMonthNew > 0
      ? (thisMonthNew - lastMonthNew) / lastMonthNew
      : thisMonthNew > 0
      ? 1
      : 0

  const proj3 = project(currentMRR, growthRate, 3)
  const proj6 = project(currentMRR, growthRate, 6)
  const proj12 = project(currentMRR, growthRate, 12)

  const growthPct = (growthRate * 100).toFixed(1)
  const growthSign = growthRate >= 0 ? '+' : ''

  // â”€â”€ Churn Risk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const activeHabitUsers = new Set((recentCompletions ?? []).map((c) => c.user_id))

  const churnUsers: ChurnUser[] = proUsers
    .map((user) => {
      const score =
        (!user.last_sign_in_at || user.last_sign_in_at < sevenDaysAgo ? 3 : 0) +
        (user.streak === 0 || user.streak === null ? 2 : 0) +
        (!activeHabitUsers.has(user.id) ? 2 : 0) +
        (user.warnings ?? 0)
      return {
        id: user.id,
        full_name: user.full_name,
        plan: user.plan,
        streak: user.streak,
        last_sign_in_at: user.last_sign_in_at,
        riskScore: score,
      }
    })
    .sort((a, b) => b.riskScore - a.riskScore)

  // â”€â”€ LTV Calculator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const now = Date.now()

  const proWithMonths = proUsers.map((user) => ({
    ...user,
    months: (now - new Date(user.created_at).getTime()) / MONTH_MS,
    cohortMonth: user.created_at.slice(0, 7),
  }))

  const avgMonths =
    proWithMonths.length > 0
      ? proWithMonths.reduce((s, u) => s + u.months, 0) / proWithMonths.length
      : 0
  const avgLTV = avgMonths * 7.99

  const cohortMap = new Map<string, number[]>()
  proWithMonths.forEach((u) => {
    if (!cohortMap.has(u.cohortMonth)) cohortMap.set(u.cohortMonth, [])
    cohortMap.get(u.cohortMonth)!.push(u.months)
  })
  const cohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, vals]) => ({
      month,
      userCount: vals.length,
      avgLTV: (vals.reduce((a, b) => a + b, 0) / vals.length) * 7.99,
    }))

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Plan and revenue overview" />

      {/* â”€â”€ Overview Stat Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Pro Users" value={proCount} color="#bc8cff" />
        <StatCard label="Free Users" value={freeCount} color="#7d8fa3" />
        <StatCard label="Pro Percentage" value={`${proPct}%`} color="#58a6ff" />
        <StatCard label="MRR" value={fmt(currentMRR)} color="#3fb950" />
      </div>

      {/* â”€â”€ Subscription Breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>Plan Split</p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Pro', count: proCount, color: '#bc8cff' },
              { label: 'Free', count: freeCount, color: '#7d8fa3' },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color }}>{label}</span>
                  <span style={{ color: '#7d8fa3' }}>{total > 0 ? Math.round((count / total) * 100) : 0}%</span>
                </div>
                <ProgressBar value={total > 0 ? (count / total) * 100 : 0} color={color} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>New Signups (30d)</p>
          <p className="text-3xl font-bold" style={{ color: '#3fb950' }}>{trialSignups}</p>
          <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>All plans</p>
        </div>
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>Trial Conversion</p>
          <p className="text-3xl font-bold" style={{ color: '#58a6ff' }}>â€”</p>
          <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>Via RevenueCat</p>
        </div>
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>Lapsed Pro (60d)</p>
          <p className="text-3xl font-bold" style={{ color: lapsedUsers.length > 0 ? '#f85149' : '#3fb950' }}>{lapsedUsers.length}</p>
          <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>Active sub, no login</p>
        </div>
      </div>

      {lapsedUsers.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-8" style={{ border: '1px solid #f85149' }}>
          <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #f85149' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f85149' }}>At-Risk Pro Users â€” No Login in 60 Days</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                {['User', 'Plan', 'Last Seen'].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lapsedUsers.map((u, i) => (
                <tr key={u.id} style={{ background: '#080b0f', borderBottom: i < lapsedUsers.length - 1 ? '1px solid #1a2332' : undefined }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: '#e6edf3' }}>{u.full_name ?? 'â€”'}</td>
                  <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded" style={{ background: '#bc8cff22', color: '#bc8cff', border: '1px solid #bc8cff' }}>Pro</span></td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: '#f85149' }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* â”€â”€ Pro Subscribers Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="rounded-lg overflow-x-auto mb-6"
        style={{ border: '1px solid #1a2332' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              {['User', 'Stage', 'Streak', 'Joined', 'Plan'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: '#7d8fa3' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proUsers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: '#7d8fa3', background: '#080b0f' }}
                >
                  No pro subscribers
                </td>
              </tr>
            )}
            {proUsers.map((user, i) => (
              <tr
                key={user.id}
                style={{
                  background: '#080b0f',
                  borderBottom: i < proUsers.length - 1 ? '1px solid #1a2332' : undefined,
                }}
              >
                <td className="px-4 py-3">
                  <p style={{ color: '#e6edf3' }}>{user.full_name ?? 'â€”'}</p>
                  {user.email && (
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>
                      {user.email}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: '#e6edf3' }}>
                  {user.stage ?? 'â€”'}
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: '#3fb950' }}>
                  {user.streak ?? 0}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Badge color="#bc8cff">Pro</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* â”€â”€ Free / Churn Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div
          className="rounded-lg p-5"
          style={{ background: '#0d1117', border: '1px solid #1a2332' }}
        >
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>
            Free Users
          </p>
          <p className="text-2xl font-bold mb-2" style={{ color: '#e6edf3' }}>
            {freeCount}
          </p>
          <p className="text-xs" style={{ color: '#7d8fa3' }}>
            Full revenue data is available via the{' '}
            <a
              href="https://app.revenuecat.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#58a6ff' }}
            >
              RevenueCat dashboard
            </a>
            .
          </p>
        </div>
        <div
          className="rounded-lg p-5"
          style={{ background: '#0d1117', border: '1px solid #1a2332' }}
        >
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>
            Churn
          </p>
          <p className="text-sm font-medium mb-1" style={{ color: '#e6edf3' }}>
            Cancellation data not available
          </p>
          <p className="text-xs" style={{ color: '#7d8fa3' }}>
            Cancellation events are delivered via RevenueCat webhook and are not yet wired to
            this dashboard.
          </p>
        </div>
      </div>

      {/* â”€â”€ Revenue Forecasting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mb-10">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Revenue Forecasting
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Current MRR" value={fmt(currentMRR)} color="#3fb950" />
          <StatCard
            label="Projected 3mo"
            value={fmt(proj3)}
            color="#58a6ff"
          />
          <StatCard
            label="Projected 6mo"
            value={fmt(proj6)}
            color="#bc8cff"
          />
          <StatCard
            label="Projected 12mo"
            value={fmt(proj12)}
            color="#39d0d8"
          />
        </div>
        <p className="text-xs" style={{ color: '#7d8fa3' }}>
          Projections assume a consistent MoM growth rate of{' '}
          <span style={{ color: growthRate >= 0 ? '#3fb950' : '#f85149' }}>
            {growthSign}
            {growthPct}%
          </span>{' '}
          based on new pro signups this month ({thisMonthNew}) vs last month ({lastMonthNew}).
          Actual growth may vary.
        </p>
      </section>

      {/* â”€â”€ Churn Risk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mb-10">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: '#7d8fa3' }}
        >
          Churn Risk
        </h2>
        <p className="text-xs mb-4" style={{ color: '#7d8fa3' }}>
          Risk score per pro user: last sign-in &gt;7d (+3), streak = 0 (+2), no habit
          completions in 7d (+2), +1 per warning. Sorted by highest risk.
        </p>
        <ChurnClient users={churnUsers} />
      </section>

      {/* â”€â”€ LTV Calculator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          LTV Calculator
        </h2>
        <div className="mb-6">
          <StatCard
            label="Average LTV"
            value={fmt(avgLTV)}
            sub={`${avgMonths.toFixed(1)} avg months Ã— $7.99`}
            color="#3fb950"
          />
        </div>

        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                {['Cohort Month', 'Users', 'Avg LTV'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#7d8fa3' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: '#7d8fa3', background: '#080b0f' }}
                  >
                    No pro user cohort data yet
                  </td>
                </tr>
              )}
              {cohorts.map((c, i) => (
                <tr
                  key={c.month}
                  style={{
                    background: '#080b0f',
                    borderBottom: i < cohorts.length - 1 ? '1px solid #1a2332' : undefined,
                  }}
                >
                  <td className="px-4 py-3 font-mono" style={{ color: '#e6edf3' }}>
                    {c.month}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#7d8fa3' }}>
                    {c.userCount}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#3fb950' }}>
                    {fmt(c.avgLTV)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

