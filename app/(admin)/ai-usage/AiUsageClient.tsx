'use client'

import { useState } from 'react'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'

// Pricing: claude-sonnet-4 — $3/1M input, $15/1M output
const INPUT_COST_PER_TOKEN = 3 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000

const FEATURE_COLORS: Record<string, string> = {
  gardener_chat: '#3fb950',
  gardener_summary: '#bc8cff',
  food_analysis: '#39d0d8',
  meal_suggestions: '#58a6ff',
  insights_summary: '#d29922',
  other: '#7d8fa3',
}

type LogRow = {
  id: string
  user_id: string | null
  feature: string | null
  input_tokens: number | null
  output_tokens: number | null
  model: string | null
  error: string | null
  duration_ms: number | null
  created_at: string
}

type Profile = {
  id: string
  display_name: string | null
  subscription_status: string | null
}

type ChatMessage = {
  session_id: string
  role: string
  created_at: string
  content: string | null
}

type Tab = 'overview' | 'by_feature' | 'per_user' | 'errors'

type Props = {
  logs: LogRow[]
  profiles: Profile[]
  chatMessages: ChatMessage[]
}

function fmt(n: number): string {
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export default function AiUsageClient({ logs, profiles, chatMessages }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  // Aggregate by feature
  const featureMap: Record<string, { calls: number; inputTokens: number; outputTokens: number; errors: number; totalMs: number }> = {}
  for (const log of logs) {
    const feature = log.feature ?? 'other'
    if (!featureMap[feature]) featureMap[feature] = { calls: 0, inputTokens: 0, outputTokens: 0, errors: 0, totalMs: 0 }
    featureMap[feature].calls++
    featureMap[feature].inputTokens += log.input_tokens ?? 0
    featureMap[feature].outputTokens += log.output_tokens ?? 0
    if (log.error) featureMap[feature].errors++
    featureMap[feature].totalMs += log.duration_ms ?? 0
  }

  const features = Object.entries(featureMap)
    .map(([feature, data]) => ({
      feature,
      ...data,
      cost: estimateCost(data.inputTokens, data.outputTokens),
      avgTokens: data.calls > 0 ? Math.round((data.inputTokens + data.outputTokens) / data.calls) : 0,
      errorRate: data.calls > 0 ? Math.round((data.errors / data.calls) * 100) : 0,
      avgMs: data.calls > 0 ? Math.round(data.totalMs / data.calls) : 0,
    }))
    .sort((a, b) => b.cost - a.cost)

  const totalCalls = logs.length
  const totalInput = logs.reduce((s, l) => s + (l.input_tokens ?? 0), 0)
  const totalOutput = logs.reduce((s, l) => s + (l.output_tokens ?? 0), 0)
  const totalCost = estimateCost(totalInput, totalOutput)
  const activeProfiles = profiles.filter((p) => p.subscription_status && p.subscription_status !== 'free').length
  const costPerUser = activeProfiles > 0 ? totalCost / activeProfiles : 0

  // Per-user aggregation
  const userMap: Record<string, { calls: number; inputTokens: number; outputTokens: number; features: Set<string> }> = {}
  for (const log of logs) {
    if (!log.user_id) continue
    if (!userMap[log.user_id]) userMap[log.user_id] = { calls: 0, inputTokens: 0, outputTokens: 0, features: new Set() }
    userMap[log.user_id].calls++
    userMap[log.user_id].inputTokens += log.input_tokens ?? 0
    userMap[log.user_id].outputTokens += log.output_tokens ?? 0
    if (log.feature) userMap[log.user_id].features.add(log.feature)
  }

  const userRows = Object.entries(userMap)
    .map(([userId, data]) => {
      const profile = profileMap.get(userId)
      const cost = estimateCost(data.inputTokens, data.outputTokens)
      const plan = profile?.subscription_status ?? 'free'
      const isPro = plan !== 'free'
      const revenue = isPro ? 7.99 : 0
      return {
        userId,
        name: profile?.display_name ?? userId.slice(0, 8) + '…',
        plan,
        calls: data.calls,
        cost,
        revenue,
        overRevenue: cost > revenue,
        features: [...data.features].join(', '),
      }
    })
    .sort((a, b) => b.cost - a.cost)

  // Day-by-day calls for last 30 days
  const dayMap: Record<string, Record<string, number>> = {}
  for (const log of logs) {
    const day = log.created_at.slice(0, 10)
    const feature = log.feature ?? 'other'
    if (!dayMap[day]) dayMap[day] = {}
    dayMap[day][feature] = (dayMap[day][feature] ?? 0) + 1
  }
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000)
    return d.toISOString().slice(0, 10)
  }).reverse()
  const maxDayCalls = Math.max(...days.map((d) => Object.values(dayMap[d] ?? {}).reduce((a, b) => a + b, 0)), 1)

  // Error logs
  const errorLogs = logs.filter((l) => l.error)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Cost Dashboard' },
    { id: 'by_feature', label: 'By Feature' },
    { id: 'per_user', label: 'Per User' },
    { id: 'errors', label: 'Errors' },
  ]

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Calls (30d)" value={totalCalls.toLocaleString()} color="#e6edf3" />
        <StatCard label="Est. Cost (30d)" value={fmt(totalCost)} color="#3fb950" />
        <StatCard label="Cost per Active User" value={fmt(costPerUser)} color="#58a6ff" />
        <StatCard label="Total Tokens (30d)" value={((totalInput + totalOutput) / 1000).toFixed(0) + 'k'} color="#bc8cff" />
      </div>

      {/* Tabs */}
      <div className="flex mb-6" style={{ borderBottom: '1px solid #1a2332' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === t.id ? '#3fb950' : 'transparent'}`,
              color: tab === t.id ? '#e6edf3' : '#7d8fa3',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cost Dashboard */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Cost breakdown by feature */}
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
                Cost by Feature (30d)
              </p>
              <div className="flex flex-col gap-3">
                {features.length === 0 && (
                  <p className="text-xs" style={{ color: '#7d8fa3' }}>No AI usage logged yet</p>
                )}
                {features.map(({ feature, cost, calls }) => {
                  const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0
                  const color = FEATURE_COLORS[feature] ?? '#7d8fa3'
                  return (
                    <div key={feature}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span style={{ color: '#e6edf3' }}>{feature}</span>
                        <span style={{ color: '#7d8fa3' }}>{fmt(cost)} · {calls} calls</span>
                      </div>
                      <ProgressBar value={pct} color={color} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Daily usage chart */}
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
                Calls per Day (30d)
              </p>
              <div className="flex items-end gap-0.5 h-32">
                {days.map((day) => {
                  const total = Object.values(dayMap[day] ?? {}).reduce((a, b) => a + b, 0)
                  const height = maxDayCalls > 0 ? Math.round((total / maxDayCalls) * 100) : 0
                  return (
                    <div
                      key={day}
                      title={`${day}: ${total} calls`}
                      style={{
                        flex: 1,
                        height: `${Math.max(height, 2)}%`,
                        background: '#3fb950',
                        opacity: 0.7,
                        borderRadius: '2px 2px 0 0',
                        minHeight: 2,
                      }}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: '#7d8fa3' }}>
                <span>{days[0]?.slice(5)}</span>
                <span>{days[days.length - 1]?.slice(5)}</span>
              </div>
            </div>
          </div>

          {/* Summary table */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
            <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                Feature Summary
              </p>
            </div>
            {features.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs" style={{ background: '#080b0f', color: '#7d8fa3' }}>
                No AI usage data in the last 30 days. Ensure ai_usage_log table is populated.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                    {['Feature', 'Calls', 'Input Tokens', 'Output Tokens', 'Avg Tokens/Call', 'Est. Cost', 'Error Rate'].map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((f, i) => (
                    <tr key={f.feature} style={{ background: '#080b0f', borderBottom: i < features.length - 1 ? '1px solid #1a2332' : undefined }}>
                      <td className="px-4 py-2.5">
                        <Badge color={FEATURE_COLORS[f.feature] ?? '#7d8fa3'}>{f.feature}</Badge>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: '#e6edf3' }}>{f.calls.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{f.inputTokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{f.outputTokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{f.avgTokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: '#3fb950' }}>{fmt(f.cost)}</td>
                      <td className="px-4 py-2.5 text-xs font-medium" style={{ color: f.errorRate > 5 ? '#f85149' : f.errorRate > 0 ? '#d29922' : '#3fb950' }}>
                        {f.errorRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* By Feature tab */}
      {tab === 'by_feature' && (
        <div className="flex flex-col gap-6">
          {features.map((f) => (
            <div key={f.feature} className="rounded-lg p-5" style={{ background: '#0d1117', border: `1px solid ${FEATURE_COLORS[f.feature] ?? '#1a2332'}22` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge color={FEATURE_COLORS[f.feature] ?? '#7d8fa3'}>{f.feature}</Badge>
                  <span className="text-xs" style={{ color: '#7d8fa3' }}>{f.calls} calls · {fmt(f.cost)}</span>
                </div>
                <span className="text-xs" style={{ color: f.errorRate > 5 ? '#f85149' : '#7d8fa3' }}>
                  {f.errorRate}% error rate
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total calls', value: f.calls.toLocaleString(), color: '#e6edf3' },
                  { label: 'Avg tokens/call', value: f.avgTokens.toLocaleString(), color: '#7d8fa3' },
                  { label: 'Est. cost', value: fmt(f.cost), color: '#3fb950' },
                  { label: 'Avg response', value: f.avgMs > 0 ? `${f.avgMs}ms` : '—', color: '#58a6ff' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                    <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>{label}</p>
                    <p className="text-lg font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {features.length === 0 && (
            <p className="text-xs" style={{ color: '#7d8fa3' }}>No usage data. Ensure ai_usage_log table is populated by edge functions.</p>
          )}
        </div>
      )}

      {/* Per User tab */}
      {tab === 'per_user' && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
          {userRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs" style={{ background: '#080b0f', color: '#7d8fa3' }}>
              No per-user usage data
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                  {['User', 'Plan', 'Calls (30d)', 'Est. Cost', 'MRR Revenue', 'Over Revenue?', 'Features Used'].map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userRows.map((u, i) => (
                  <tr key={u.userId} style={{ background: '#080b0f', borderBottom: i < userRows.length - 1 ? '1px solid #1a2332' : undefined }}>
                    <td className="px-4 py-2.5" style={{ color: '#e6edf3' }}>{u.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge color={u.plan === 'pro' ? '#bc8cff' : '#7d8fa3'}>{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#7d8fa3' }}>{u.calls}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#3fb950' }}>{fmt(u.cost)}</td>
                    <td className="px-4 py-2.5" style={{ color: '#7d8fa3' }}>{u.revenue > 0 ? fmt(u.revenue) : '—'}</td>
                    <td className="px-4 py-2.5">
                      {u.overRevenue && u.revenue > 0 ? (
                        <Badge color="#f85149">Over budget</Badge>
                      ) : (
                        <span className="text-xs" style={{ color: '#3fb950' }}>✓</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-xs truncate" style={{ color: '#7d8fa3' }}>{u.features || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Errors tab */}
      {tab === 'errors' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Total errors (30d)</p>
              <p className="text-2xl font-bold" style={{ color: '#f85149' }}>{errorLogs.length}</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Overall error rate</p>
              <p className="text-2xl font-bold" style={{ color: totalCalls > 0 && (errorLogs.length / totalCalls) > 0.05 ? '#f85149' : '#d29922' }}>
                {totalCalls > 0 ? Math.round((errorLogs.length / totalCalls) * 100) : 0}%
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Avg duration (successful)</p>
              <p className="text-2xl font-bold" style={{ color: '#7d8fa3' }}>
                {(() => {
                  const successful = logs.filter((l) => !l.error && l.duration_ms)
                  return successful.length > 0
                    ? `${Math.round(successful.reduce((s, l) => s + (l.duration_ms ?? 0), 0) / successful.length)}ms`
                    : '—'
                })()}
              </p>
            </div>
          </div>

          {errorLogs.length === 0 ? (
            <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#7d8fa3' }}>
              No errors in the last 30 days
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                    {['Time', 'Feature', 'Error', 'Model', 'Duration'].map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {errorLogs.slice(0, 100).map((l, i) => (
                    <tr key={l.id} style={{ background: '#080b0f', borderBottom: i < Math.min(errorLogs.length, 100) - 1 ? '1px solid #1a2332' : undefined }}>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={FEATURE_COLORS[l.feature ?? ''] ?? '#7d8fa3'}>{l.feature ?? '—'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-xs truncate" style={{ color: '#f85149' }}>
                        {l.error ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{l.model ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                        {l.duration_ms ? `${l.duration_ms}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
