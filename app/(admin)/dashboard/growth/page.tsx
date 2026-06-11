/*
 * PostHog events required in the main React Native app to power this dashboard for real.
 * Fire these using the PostHog React Native SDK. Once volume justifies it, wire them to a
 * posthog_events mirror table in Supabase via a PostHog webhook.
 *
 * feature_gate_hit          â€” { feature: string, user_id: string, plan: 'free' }
 *   Fired whenever a Free user hits a paywalled feature.
 *
 * upgrade_prompt_shown      â€” { trigger: string, user_id: string, streak: number }
 *   Fired when an upgrade prompt is surfaced to a Free user.
 *
 * upgrade_prompt_converted  â€” { user_id: string, from_plan: 'free', to_plan: string }
 *   Fired when a user completes a purchase after seeing an upgrade prompt.
 *
 * churn_risk_reengaged      â€” { user_id: string, days_inactive: number }
 *   Fired when a previously-inactive paid user opens the app again.
 *
 * ai_call_made              â€” { user_id: string, plan: string, feature: string, calls_used: number, calls_remaining: number }
 *   Fired on every AI Gardener / AI feature invocation.
 */

import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import UpgradeButton from './UpgradeButton'
import { getUpgradeCandidates, getChurnRisks, getRevenueSignals } from '@/lib/queries/growth'

// Feature gate hit counts sourced from ai_usage_log and user activity tables.
// Conversion rates require PostHog event tracking â€” show placeholder until wired.

const FREE_AI_LIMIT = 10
const GROWTH_AI_LIMIT = 50
// TODO: Update to match actual Edge Function cost from the Anthropic dashboard.
const COST_PER_CALL = 0.004

function usagePct(used: number, limit: number) {
  return Math.min(100, (used / limit) * 100)
}

function usageColor(pct: number) {
  if (pct >= 90) return '#f85149'
  if (pct >= 70) return '#d29922'
  return '#3fb950'
}

function InlineBar({
  used,
  limit,
  isPro = false,
}: {
  used: number
  limit: number
  isPro?: boolean
}) {
  const pct = isPro ? Math.min(100, (used / 200) * 100) : usagePct(used, limit)
  const color = isPro ? '#58a6ff' : usageColor(pct)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 rounded-full h-1.5 shrink-0" style={{ background: '#1a2332' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs" style={{ color: '#7d8fa3' }}>
        {isPro ? used : `${pct.toFixed(0)}%`}
      </span>
    </div>
  )
}

const TH = ({ children }: { children?: React.ReactNode }) => (
  <th
    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
    style={{ color: '#7d8fa3' }}
  >
    {children}
  </th>
)

export default async function GrowthPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const supabase = await createClient()

  const [upgradeCandidates, churnRisks, signals, { data: journalData }, aiUsageResult, nutritionResult, sleepResult, goalsResult] = await Promise.all([
    getUpgradeCandidates(),
    getChurnRisks(),
    getRevenueSignals(),
    supabase.from('journal_entries').select('user_id').gte('created_at', sevenDaysAgo),
    // AI Gardener usage by free users this month
    Promise.resolve(supabase.from('ai_usage_log').select('user_id').eq('feature', 'gardener_chat').gte('created_at', thirtyDaysAgo)).catch(() => ({ data: null })),
    // Nutrition tracker usage by free users this month (food_logs)
    Promise.resolve(supabase.from('food_logs').select('user_id').gte('created_at', thirtyDaysAgo)).catch(() => ({ data: null })),
    // Sleep insights usage this month
    Promise.resolve(supabase.from('sleep_logs').select('user_id').gte('created_at', thirtyDaysAgo)).catch(() => ({ data: null })),
    // Goals created by free users this month
    Promise.resolve(supabase.from('goals').select('user_id').gte('created_at', thirtyDaysAgo)).catch(() => ({ data: null })),
  ])

  const countUnique = (rows: { user_id: string }[] | null) =>
    new Set((rows ?? []).map((r) => r.user_id)).size

  const featureGateData = [
    { feature: 'AI Gardener calls', free_hits: countUnique((aiUsageResult as { data: { user_id: string }[] | null }).data) },
    { feature: 'Nutrition tracker', free_hits: countUnique((nutritionResult as { data: { user_id: string }[] | null }).data) },
    { feature: 'Sleep insights', free_hits: countUnique((sleepResult as { data: { user_id: string }[] | null }).data) },
    { feature: 'Goal tracking', free_hits: countUnique((goalsResult as { data: { user_id: string }[] | null }).data) },
  ]

  // Build log-frequency map: logs in last 7 days per user â†’ avg per day
  const logCountMap: Record<string, number> = {}
  ;(journalData ?? []).forEach((e) => {
    logCountMap[e.user_id] = (logCountMap[e.user_id] ?? 0) + 1
  })

  // Upgrade candidates scored and sorted
  const scored = upgradeCandidates
    .map((u) => {
      const streak = u.streak ?? 0
      const aiCalls = u.ai_calls_used_this_month ?? 0
      const logFreq = (logCountMap[u.id] ?? 0) / 7
      const score = Math.round(streak * 0.4 + logFreq * 30 + aiCalls * 0.3)
      return { ...u, logFreq, score }
    })
    .sort((a, b) => b.score - a.score)

  // Churn candidates with computed scores
  const now = Date.now()
  const churnScored = churnRisks.map((u) => {
    const lastActiveDays = u.last_sign_in_at
      ? Math.floor((now - new Date(u.last_sign_in_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    const streakBroken = u.streak === 0
    const churnScore = Math.min(100, Math.round(lastActiveDays * 0.5 + (streakBroken ? 30 : 0)))
    return { ...u, lastActiveDays, streakBroken, churnScore }
  })

  // Section D
  const conversionRate =
    signals.totalUsers > 0
      ? ((signals.paidUsers / signals.totalUsers) * 100).toFixed(1)
      : '0.0'
  const atRiskMRR = (signals.churnHighRiskCount * 7.99).toFixed(2)
  const estimatedApiCost = (signals.totalApiCalls * COST_PER_CALL).toFixed(2)

  return (
    <div>
      <PageHeader
        title="Growth Intelligence"
        subtitle="Upgrade opportunities, churn risks, and API cost signals"
      />

      {/* â”€â”€ Section A â€” Upgrade Opportunity Queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mb-10">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Upgrade Opportunity Queue
        </h2>
        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                <TH>User</TH>
                <TH>Plan</TH>
                <TH>Streak</TH>
                <TH>AI Calls</TH>
                <TH>Usage</TH>
                <TH>Log Freq</TH>
                <TH>Score</TH>
                <TH></TH>
              </tr>
            </thead>
            <tbody>
              {scored.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: '#7d8fa3', background: '#080b0f' }}
                  >
                    No free-tier users found
                  </td>
                </tr>
              ) : (
                scored.map((u, i) => (
                  <tr
                    key={u.id}
                    style={{
                      background: '#080b0f',
                      borderBottom: i < scored.length - 1 ? '1px solid #1a2332' : undefined,
                    }}
                  >
                    <td className="px-4 py-3" style={{ color: '#e6edf3' }}>
                      {u.username ?? 'â€”'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color="#7d8fa3">{u.plan ?? 'free'}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#3fb950' }}>
                      {u.streak ?? 0}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#e6edf3' }}>
                      {u.ai_calls_used_this_month ?? 0} / {FREE_AI_LIMIT}
                    </td>
                    <td className="px-4 py-3">
                      <InlineBar
                        used={u.ai_calls_used_this_month ?? 0}
                        limit={FREE_AI_LIMIT}
                      />
                    </td>
                    <td className="px-4 py-3" style={{ color: '#7d8fa3' }}>
                      {u.logFreq.toFixed(1)}/d
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: '#e6edf3' }}>
                          {u.score}
                        </span>
                        {u.score > 60 && <Badge color="#d29922">Hot lead</Badge>}
                        {u.score >= 40 && u.score <= 60 && (
                          <Badge color="#58a6ff">Warm</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <UpgradeButton userId={u.id} username={u.username ?? u.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* â”€â”€ Section B â€” Churn Risk Monitor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mb-10">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Churn Risk Monitor
        </h2>
        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                <TH>User</TH>
                <TH>Plan</TH>
                <TH>Last Active</TH>
                <TH>Streak Broken</TH>
                <TH>AI Calls</TH>
                <TH>Usage</TH>
                <TH>Churn Risk</TH>
              </tr>
            </thead>
            <tbody>
              {churnScored.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: '#7d8fa3', background: '#080b0f' }}
                  >
                    No paid users found
                  </td>
                </tr>
              ) : (
                churnScored.map((u, i) => {
                  const isPro = u.plan?.toLowerCase() === 'pro'
                  const callLimit = isPro ? null : GROWTH_AI_LIMIT
                  return (
                    <tr
                      key={u.id}
                      style={{
                        background: '#080b0f',
                        borderBottom:
                          i < churnScored.length - 1 ? '1px solid #1a2332' : undefined,
                      }}
                    >
                      <td className="px-4 py-3" style={{ color: '#e6edf3' }}>
                        {u.username ?? 'â€”'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={isPro ? '#bc8cff' : '#58a6ff'}>{u.plan}</Badge>
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{ color: u.lastActiveDays > 7 ? '#f85149' : '#7d8fa3' }}
                      >
                        {u.lastActiveDays}d ago
                      </td>
                      <td className="px-4 py-3">
                        {u.streakBroken ? (
                          <Badge color="#f85149">Yes</Badge>
                        ) : (
                          <span style={{ color: '#7d8fa3' }}>No</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#e6edf3' }}>
                        {u.ai_calls_used_this_month ?? 0} /{' '}
                        {isPro ? 'âˆž' : callLimit}
                      </td>
                      <td className="px-4 py-3">
                        <InlineBar
                          used={u.ai_calls_used_this_month ?? 0}
                          limit={callLimit ?? 200}
                          isPro={isPro}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: '#e6edf3' }}>
                            {u.churnScore}
                          </span>
                          {u.churnScore > 70 && <Badge color="#f85149">High risk</Badge>}
                          {u.churnScore >= 40 && u.churnScore <= 70 && (
                            <Badge color="#d29922">Medium</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* â”€â”€ Section C â€” Feature Gate Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mb-10">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Feature Gate Performance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featureGateData.map((item) => (
            <div
              key={item.feature}
              className="rounded-lg p-5 flex flex-col gap-1"
              style={{ background: '#0d1117', border: '1px solid #1a2332' }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: '#7d8fa3' }}>
                {item.feature}
              </p>
              <p className="text-3xl font-bold" style={{ color: '#e6edf3' }}>
                {item.free_hits.toLocaleString()}
              </p>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>
                unique users Â· last 30d
              </p>
              <p className="text-sm" style={{ color: '#7d8fa3' }}>
                Conversion: <span style={{ color: '#d29922' }}>Tracking soon</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ Section D â€” Revenue & API Cost Signals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Revenue & API Cost Signals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Free â†’ Paid Conversion"
            value={`${conversionRate}%`}
            color="#3fb950"
          />
          <StatCard
            label="Avg Streak at Conversion"
            value="14 days"
            sub="TODO: wire to real data"
            color="#58a6ff"
          />
          <StatCard
            label="At-Risk MRR"
            value={`$${atRiskMRR}`}
            sub="churn score >70 Ã— $7.99"
            color="#f85149"
          />
          <StatCard label="New Paid (30d)" value={signals.newPaid30d} color="#d29922" />
          <div
            className="rounded-lg p-5 flex flex-col gap-1"
            style={{ background: '#0d1117', border: '1px solid #1a2332' }}
          >
            <p className="text-xs uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
              Est. Claude API Cost
            </p>
            <p className="text-2xl font-bold" style={{ color: '#bc8cff' }}>
              ${estimatedApiCost}
            </p>
            {/* TODO: Update COST_PER_CALL (currently $0.004) to match actual Edge Function cost from Anthropic dashboard. */}
            <p className="text-xs" style={{ color: '#7d8fa3' }}>
              @ $0.004 per call est.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

