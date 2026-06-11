'use client'

import { useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'

type CohortRow = { week: string; signups: number; active: number }
type FeatureRow = { label: string; count: number | null; color: string }
type StageRow = [string, number]

type ChatDayRow = { date: string; messages: number; sessions: number }
type TopMessage = { content: string; count: number }

type Props = {
  dau: number
  wau: number
  mau: number
  newSignups: number
  total: number
  features: FeatureRow[]
  stageEntries: StageRow[]
  cohorts: CohortRow[]
  // Gardener Chat
  chatDays: ChatDayRow[]
  avgMessagesPerSession: number
  totalChatSessions: number
  totalChatMessages: number
  chatDropOffPct: number
  topFirstMessages: TopMessage[]
  avgResponseMs: number
  // Insights
  insightViews30d: number
  insightViewsYesterday: number
  patternTapRate: number
  chatOpenRate: number
}

type Tab = 'overview' | 'gardener_chat' | 'insights'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'gardener_chat', label: 'Gardener Chat' },
  { key: 'insights', label: 'Insights Page' },
]

function MiniBarChart({ rows, valueKey, labelKey, color = '#3fb950', unit = '' }: {
  rows: Record<string, unknown>[]
  valueKey: string
  labelKey: string
  color?: string
  unit?: string
}) {
  const vals = rows.map((r) => Number(r[valueKey] ?? 0))
  const max = Math.max(...vals, 1)
  return (
    <div className="flex items-end gap-1" style={{ height: 64 }}>
      {rows.map((r, i) => {
        const val = Number(r[valueKey] ?? 0)
        const pct = (val / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${String(r[labelKey])}: ${val}${unit}`}>
            <div className="w-full rounded-sm" style={{ height: `${Math.max(pct, 4)}%`, background: color, minHeight: 2 }} />
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsClient({
  dau, wau, mau, newSignups, total, features, stageEntries, cohorts,
  chatDays, avgMessagesPerSession, totalChatSessions, totalChatMessages,
  chatDropOffPct, topFirstMessages, avgResponseMs,
  insightViews30d, insightViewsYesterday, patternTapRate, chatOpenRate,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Usage and engagement metrics" />

      <div className="flex mb-6" style={{ borderBottom: '1px solid #1a2332' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === t.key ? '#3fb950' : 'transparent'}`,
              color: tab === t.key ? '#e6edf3' : '#7d8fa3',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard label="DAU" value={dau} sub="Active today" color="#3fb950" />
            <StatCard label="WAU" value={wau} sub="Active this week" color="#58a6ff" />
            <StatCard label="MAU" value={mau} sub="Active this month" color="#bc8cff" />
            <StatCard label="New Signups Today" value={newSignups} color="#39d0d8" />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Feature Adoption</p>
              <div className="flex flex-col gap-4">
                {features.map(({ label, count, color }) => {
                  const pct = count === null ? null : Math.round((count / Math.max(total, 1)) * 100)
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span style={{ color: '#e6edf3' }}>{label}</span>
                        <span style={{ color: '#7d8fa3' }}>{count === null ? 'no data' : `${count} users · ${pct}%`}</span>
                      </div>
                      <ProgressBar value={pct ?? 0} color={color} />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Stage Distribution</p>
              <div className="flex flex-col gap-3">
                {stageEntries.length > 0 ? stageEntries.map(([stage, count]) => (
                  <div key={stage}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: '#e6edf3' }}>{stage}</span>
                      <span style={{ color: '#7d8fa3' }}>{count} · {Math.round((count / Math.max(total, 1)) * 100)}%</span>
                    </div>
                    <ProgressBar value={(count / Math.max(total, 1)) * 100} color="#3fb950" />
                  </div>
                )) : <p className="text-xs" style={{ color: '#7d8fa3' }}>No stage data</p>}
              </div>
            </div>
          </div>

          <div className="rounded-lg p-5 mb-8" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Retention</p>
              <a href="https://app.posthog.com" target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: '#58a6ff' }}>
                View in PostHog →
              </a>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {['D1', 'D7', 'D30'].map((label) => (
                <div key={label} className="rounded-lg p-4 flex flex-col gap-2" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{label} Retention</p>
                  <p className="text-2xl font-bold" style={{ color: '#1a2332' }}>—</p>
                  <p className="text-xs" style={{ color: '#7d8fa3' }}>Full data in PostHog</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
            <div className="px-5 py-4" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Cohort Analysis — Last 8 Signup Weeks</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                  {['Cohort Week', 'Signups', 'Still Active', 'Retention Rate'].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c, i) => {
                  const pct = c.signups > 0 ? Math.round((c.active / c.signups) * 100) : 0
                  const pctColor = pct >= 60 ? '#3fb950' : pct >= 30 ? '#d29922' : '#f85149'
                  return (
                    <tr key={c.week} style={{ background: '#080b0f', borderBottom: i < cohorts.length - 1 ? '1px solid #1a2332' : undefined }}>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: '#e6edf3' }}>{c.week}</td>
                      <td className="px-5 py-3" style={{ color: '#e6edf3' }}>{c.signups}</td>
                      <td className="px-5 py-3" style={{ color: '#58a6ff' }}>{c.active}</td>
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
      )}

      {/* ── Gardener Chat Tab ──────────────────────────────────────────────── */}
      {tab === 'gardener_chat' && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Sessions" value={totalChatSessions} color="#3fb950" />
            <StatCard label="Total Messages" value={totalChatMessages} color="#58a6ff" />
            <StatCard label="Avg Msgs / Session" value={avgMessagesPerSession.toFixed(1)} color="#bc8cff" />
            <StatCard label="Drop-Off Rate" value={`${chatDropOffPct}%`} sub="1 message only" color={chatDropOffPct > 50 ? '#f85149' : '#d29922'} />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Messages Per Day — Last 30 Days</p>
              {chatDays.length > 0 ? (
                <>
                  <MiniBarChart rows={chatDays as Record<string, unknown>[]} valueKey="messages" labelKey="date" color="#3fb950" />
                  <div className="flex justify-between text-xs mt-2" style={{ color: '#7d8fa3' }}>
                    <span>{chatDays[0]?.date?.slice(5)}</span>
                    <span>{chatDays[chatDays.length - 1]?.date?.slice(5)}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: '#7d8fa3' }}>No chat data yet</p>
              )}
            </div>

            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Sessions Per Day — Last 30 Days</p>
              {chatDays.length > 0 ? (
                <>
                  <MiniBarChart rows={chatDays as Record<string, unknown>[]} valueKey="sessions" labelKey="date" color="#bc8cff" />
                  <div className="flex justify-between text-xs mt-2" style={{ color: '#7d8fa3' }}>
                    <span>{chatDays[0]?.date?.slice(5)}</span>
                    <span>{chatDays[chatDays.length - 1]?.date?.slice(5)}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: '#7d8fa3' }}>No chat data yet</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Top First Messages</p>
              {topFirstMessages.length === 0 ? (
                <p className="text-xs" style={{ color: '#7d8fa3' }}>No data yet</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {topFirstMessages.map((msg, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <p className="text-xs flex-1" style={{ color: '#e6edf3' }}>
                        &ldquo;{msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content}&rdquo;
                      </p>
                      <span className="text-xs shrink-0 font-medium" style={{ color: '#7d8fa3' }}>×{msg.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Performance</p>
              <div className="flex flex-col gap-4">
                {[
                  { label: 'Avg response time', value: avgResponseMs > 0 ? `${(avgResponseMs / 1000).toFixed(1)}s` : '—', color: avgResponseMs > 10000 ? '#f85149' : '#3fb950' },
                  { label: 'Single-message drop-off', value: `${chatDropOffPct}%`, color: chatDropOffPct > 60 ? '#f85149' : chatDropOffPct > 35 ? '#d29922' : '#3fb950' },
                  { label: 'Avg messages per session', value: avgMessagesPerSession.toFixed(1), color: '#58a6ff' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#7d8fa3' }}>{label}</span>
                    <span className="text-sm font-medium" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Insights Page Tab ──────────────────────────────────────────────── */}
      {tab === 'insights' && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard label="Insights Views (30d)" value={insightViews30d} color="#3fb950" />
            <StatCard label="Views Yesterday" value={insightViewsYesterday} color="#58a6ff" />
            <StatCard label="Pattern Card Tap Rate" value={`${patternTapRate}%`} color="#bc8cff" sub="tapped a pattern card" />
            <StatCard label="Chat Open Rate" value={`${chatOpenRate}%`} color="#39d0d8" sub="tapped Ask Gardener" />
          </div>

          <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Notes</p>
            <div className="flex flex-col gap-3">
              {[
                'Pattern tap rate and chat open rate are derived from gardener_chat_sessions and page_views tables.',
                'Full funnel data (scroll depth, time on page) is available in PostHog.',
                'Insights page views are tracked in page_views where page_name = \'gardener_insights\'.',
              ].map((note, i) => (
                <p key={i} className="text-xs" style={{ color: '#7d8fa3' }}>• {note}</p>
              ))}
            </div>
            <a href="https://app.posthog.com" target="_blank" rel="noreferrer" className="inline-block mt-4 text-xs underline" style={{ color: '#58a6ff' }}>
              Full funnel in PostHog →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
