'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { markFalsePositive, markFlagReviewed } from '@/app/actions/safety'

type FlagRow = {
  id: string
  user_id: string
  source: string | null
  layer_caught: string | null
  action_taken: string | null
  trigger_text: string | null
  created_at: string
  original_response?: string | null
  user_name: string | null
  user_email?: string | null
  user_plan?: string | null
  country_code: string | null
  resources_returned?: string | null
  session_id?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
}

type CountryRow = { code: string; count: number; covered: boolean }

type Tab = 'all' | 'crisis' | 'flags' | 'rate_limit' | 'false_positives' | 'countries'

const C = {
  bg: '#080b0f', surface: '#0d1117', border: '#1a2332',
  text: '#e6edf3', muted: '#7d8fa3',
  green: '#3fb950', red: '#f85149', amber: '#d29922', blue: '#58a6ff',
}

const LAYER_COLORS: Record<string, string> = {
  crisis: '#f85149', input: '#d29922', output: '#d29922',
  scope: '#7d8fa3', rate_limit: '#7d8fa3',
}

const LAYER_EXPLANATIONS: Record<string, string> = {
  crisis: 'User expressed crisis or distress — crisis resources were shown automatically.',
  input: 'User input triggered a safety pattern check before reaching the AI.',
  output: 'AI output was filtered or modified before being shown to the user.',
  scope: 'Message was out of scope for The Gardener — only personal growth topics allowed.',
  rate_limit: 'User hit the message rate limit (20 messages/hour).',
}

const ACTION_EXPLANATIONS: Record<string, string> = {
  replaced: 'The AI response was replaced with safe, supportive content.',
  blocked: 'The message was blocked and not sent to the AI.',
  resources: 'Crisis support resources were shown to the user.',
  warned: 'The user was given context about scope or limits.',
  rate_limited: 'The message was rejected until the rate limit window resets.',
}

const CRISIS_RESOURCES: Record<string, { name: string; phone: string; text?: string }[]> = {
  AU: [
    { name: 'Lifeline', phone: '13 11 14', text: 'Text 0477 13 11 14' },
    { name: 'Beyond Blue', phone: '1300 22 4636' },
  ],
  US: [
    { name: '988 Suicide & Crisis Lifeline', phone: '988', text: 'Text HOME to 741741' },
  ],
  GB: [
    { name: 'Samaritans', phone: '116 123' },
  ],
  NZ: [
    { name: 'Lifeline NZ', phone: '0800 543 354' },
  ],
  CA: [
    { name: 'Crisis Services Canada', phone: '1-833-456-4566' },
  ],
  DEFAULT: [
    { name: 'Find a helpline', phone: 'findahelpline.com' },
  ],
}

function layerColor(layer: string | null) {
  return LAYER_COLORS[layer ?? ''] ?? '#7d8fa3'
}

function exportCSV(rows: FlagRow[], filename: string) {
  const headers = ['created_at', 'user_name', 'source', 'layer_caught', 'action_taken', 'trigger_text', 'reviewed_at']
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = (r as Record<string, unknown>)[h]
        if (v == null) return ''
        return `"${String(v).replace(/"/g, '""').slice(0, 200)}"`
      }).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportFlagJSON(flag: FlagRow) {
  const blob = new Blob([JSON.stringify(flag, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flag_${flag.id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

type Props = {
  flags: FlagRow[]
  totalCrisisAllTime: number
  lastMonthCrisis: number
  thisMonthCrisis: number
  countryList: CountryRow[]
  unreviewedCrisisCount?: number
}

export default function SafetyClient({
  flags,
  totalCrisisAllTime,
  lastMonthCrisis,
  thisMonthCrisis,
  countryList,
  unreviewedCrisisCount = 0,
}: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [drawerFlag, setDrawerFlag] = useState<FlagRow | null>(null)
  const [markedFP, setMarkedFP] = useState<Set<string>>(new Set())
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [showReviewedFilter, setShowReviewedFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [layerFilter, setLayerFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const isReviewed = (f: FlagRow) => !!f.reviewed_at || reviewedIds.has(f.id)

  const crisisFlags = flags.filter((f) => f.layer_caught === 'crisis')
  const rateLimitFlags = flags.filter((f) => f.layer_caught === 'rate_limit')
  const falsePositives = flags.filter(
    (f) => f.layer_caught === 'output' && f.action_taken === 'replaced' && !f.trigger_text?.match(/\b(suicide|harm|crisis|die|hurt)\b/i)
  )

  const filteredAll = flags.filter((f) => {
    if (sourceFilter !== 'all' && f.source !== sourceFilter) return false
    if (layerFilter !== 'all' && f.layer_caught !== layerFilter) return false
    if (showReviewedFilter === 'unreviewed' && isReviewed(f)) return false
    if (showReviewedFilter === 'reviewed' && !isReviewed(f)) return false
    if (search && !f.user_name?.toLowerCase().includes(search.toLowerCase()) && !f.trigger_text?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const rateLimitByUser: Record<string, { user_name: string | null; count: number; first: string; last: string }> = {}
  for (const f of rateLimitFlags) {
    if (!rateLimitByUser[f.user_id]) {
      rateLimitByUser[f.user_id] = { user_name: f.user_name, count: 0, first: f.created_at, last: f.created_at }
    }
    rateLimitByUser[f.user_id].count++
    if (f.created_at < rateLimitByUser[f.user_id].first) rateLimitByUser[f.user_id].first = f.created_at
    if (f.created_at > rateLimitByUser[f.user_id].last) rateLimitByUser[f.user_id].last = f.created_at
  }
  const rateLimitUsers = Object.entries(rateLimitByUser)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.count - a.count)

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All Flags', count: flags.length },
    { id: 'crisis', label: 'Crisis Events', count: crisisFlags.length },
    { id: 'false_positives', label: 'False Positives', count: falsePositives.length },
    { id: 'rate_limit', label: 'Rate Limit Abuse', count: rateLimitUsers.filter(u => u.count >= 3).length },
    { id: 'countries', label: 'Resource Coverage' },
  ]

  const inp: React.CSSProperties = {
    background: C.bg, border: `1px solid ${C.border}`, color: C.text,
    borderRadius: 4, padding: '6px 10px', fontSize: 13, outline: 'none',
  }

  function FlagTable({ rows, showDrawer }: { rows: FlagRow[]; showDrawer?: boolean }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}>
          No records found
        </div>
      )
    }
    return (
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
              {['', 'Time', 'User', 'Layer', 'Action', 'Trigger'].map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((f, i) => {
              const reviewed = isReviewed(f)
              const isCrisisUnreviewed = f.layer_caught === 'crisis' && !reviewed
              return (
                <tr
                  key={f.id}
                  style={{
                    background: f.layer_caught === 'crisis' ? 'rgba(248,81,73,0.05)' : C.bg,
                    borderBottom: `1px solid ${C.border}`,
                    cursor: showDrawer ? 'pointer' : undefined,
                    opacity: reviewed ? 0.6 : 1,
                  }}
                  onClick={() => showDrawer && setDrawerFlag(f)}
                >
                  <td className="px-3 py-2.5">
                    {isCrisisUnreviewed && (
                      <div className="w-2 h-2 rounded-full" style={{ background: C.red, boxShadow: `0 0 4px ${C.red}` }} title="Unreviewed crisis" />
                    )}
                    {reviewed && (
                      <span className="text-xs" style={{ color: C.green }}>✓</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: C.muted }}>
                    {new Date(f.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: C.text }}>
                    {f.user_name ?? f.user_id.slice(0, 8) + '…'}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.layer_caught && (
                      <Badge color={layerColor(f.layer_caught)}>{f.layer_caught}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.action_taken && <Badge color={C.blue}>{f.action_taken}</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-xs truncate" style={{ color: C.muted }}>
                    {f.trigger_text ? f.trigger_text.slice(0, 60) + (f.trigger_text.length > 60 ? '…' : '') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const crisisResources = drawerFlag?.country_code
    ? (CRISIS_RESOURCES[drawerFlag.country_code.toUpperCase()] ?? CRISIS_RESOURCES.DEFAULT)
    : CRISIS_RESOURCES.DEFAULT

  return (
    <div>
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Crisis Events All Time" value={totalCrisisAllTime} color={C.red} />
        <StatCard label="Crisis This Month" value={thisMonthCrisis} color={C.red} />
        <StatCard label="Crisis Last Month" value={lastMonthCrisis} color={C.amber} />
        <StatCard
          label="Unreviewed Crisis"
          value={unreviewedCrisisCount}
          color={unreviewedCrisisCount > 0 ? C.red : C.green}
          sub={unreviewedCrisisCount > 0 ? 'Needs review' : 'All reviewed'}
        />
      </div>

      {/* Tabs */}
      <div className="flex mb-6" style={{ borderBottom: `1px solid ${C.border}` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer flex items-center gap-2"
            style={{
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? C.green : 'transparent'}`,
              color: tab === t.id ? C.text : C.muted,
              marginBottom: '-1px',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: t.id === 'crisis' ? '#f8514922' : C.border, color: t.id === 'crisis' ? C.red : C.muted }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* All Flags tab */}
      {tab === 'all' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input placeholder="Search user or trigger text…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, width: 260 }} />
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ ...inp, width: 140 }}>
              <option value="all">All sources</option>
              <option value="chat">chat</option>
              <option value="summary">summary</option>
            </select>
            <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value)} style={{ ...inp, width: 160 }}>
              <option value="all">All layers</option>
              <option value="crisis">crisis</option>
              <option value="input">input</option>
              <option value="output">output</option>
              <option value="scope">scope</option>
              <option value="rate_limit">rate_limit</option>
            </select>
            <select value={showReviewedFilter} onChange={(e) => setShowReviewedFilter(e.target.value as typeof showReviewedFilter)} style={{ ...inp, width: 140 }}>
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
            </select>
            <button onClick={() => exportCSV(filteredAll, 'safety_flags.csv')} className="px-3 py-1.5 rounded text-xs" style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted }}>
              Export CSV
            </button>
          </div>
          <FlagTable rows={filteredAll} showDrawer />
        </div>
      )}

      {/* Crisis Events tab */}
      {tab === 'crisis' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: C.muted }}>
              All rows where <span style={{ color: C.red }}>layer_caught = &apos;crisis&apos;</span>. Click any row to review. Red dot = unreviewed.
            </p>
            <button onClick={() => exportCSV(crisisFlags, 'crisis_events.csv')} className="px-3 py-1.5 rounded text-xs" style={{ background: 'transparent', border: `1px solid ${C.red}`, color: C.red }}>
              Export for Safeguarding
            </button>
          </div>
          <FlagTable rows={crisisFlags} showDrawer />
        </div>
      )}

      {/* False Positives tab */}
      {tab === 'false_positives' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg p-4 mb-2" style={{ background: C.surface, border: `1px solid ${C.amber}` }}>
            <p className="text-xs" style={{ color: C.amber }}>
              Output-filter replacements that did NOT contain crisis keywords — likely false positives. Mark them to improve the output filter prompt.
            </p>
          </div>
          <FlagTable rows={falsePositives} showDrawer />
        </div>
      )}

      {/* Rate Limit Abuse tab */}
      {tab === 'rate_limit' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs mb-2" style={{ color: C.muted }}>
            Users with 3+ rate limit hits in the log window.
          </p>
          {rateLimitUsers.filter(u => u.count >= 3).length === 0 ? (
            <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}>
              No rate limit abuse detected
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    {['User', 'Hits', 'First', 'Last'].map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rateLimitUsers.filter(u => u.count >= 3).map((u, i) => (
                    <tr key={u.userId} style={{ background: C.bg, borderBottom: i < rateLimitUsers.length - 1 ? `1px solid ${C.border}` : undefined }}>
                      <td className="px-4 py-2.5 text-xs" style={{ color: C.text }}>
                        <Link href={`/users/${u.userId}`} className="hover:underline" style={{ color: C.blue }}>{u.user_name ?? u.userId.slice(0, 8) + '…'}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: u.count >= 10 ? C.red : C.amber }}>{u.count}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: C.muted }}>{new Date(u.first).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: C.muted }}>{new Date(u.last).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Countries tab */}
      {tab === 'countries' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs mb-2" style={{ color: C.muted }}>
            Crisis resource coverage by user country. Green = resources available; red = no localised resources (default set shown).
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  {['Country', 'Users', 'Coverage'].map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countryList.map((c, i) => (
                  <tr key={c.code} style={{ background: C.bg, borderBottom: i < countryList.length - 1 ? `1px solid ${C.border}` : undefined }}>
                    <td className="px-4 py-2.5 text-sm font-medium" style={{ color: C.text }}>{c.code}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: C.muted }}>{c.count}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs" style={{ color: c.covered ? C.green : C.red }}>
                        {c.covered ? '✓ Covered' : '✗ Default resources only'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over drawer */}
      {drawerFlag && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDrawerFlag(null)}>
          <div
            className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: C.surface, borderLeft: `1px solid ${C.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="px-6 py-5 flex items-start justify-between" style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {drawerFlag.layer_caught && <Badge color={layerColor(drawerFlag.layer_caught)}>{drawerFlag.layer_caught}</Badge>}
                  {drawerFlag.action_taken && <Badge color={C.blue}>{drawerFlag.action_taken}</Badge>}
                  {isReviewed(drawerFlag) && <Badge color={C.green}>Reviewed</Badge>}
                </div>
                <p className="text-xs" style={{ color: C.muted }}>{new Date(drawerFlag.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setDrawerFlag(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Trigger text */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Trigger Text</p>
                <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>
                  {drawerFlag.trigger_text ?? '—'}
                </div>
              </div>

              {/* Layer explanation */}
              {drawerFlag.layer_caught && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Why This Was Flagged</p>
                  <div className="rounded-lg p-4" style={{ background: C.bg, border: `1px solid ${layerColor(drawerFlag.layer_caught)}22` }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: layerColor(drawerFlag.layer_caught) }}>{drawerFlag.layer_caught}</p>
                    <p className="text-sm" style={{ color: C.text }}>{LAYER_EXPLANATIONS[drawerFlag.layer_caught] ?? '—'}</p>
                  </div>
                </div>
              )}

              {/* Action explanation */}
              {drawerFlag.action_taken && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Action Taken</p>
                  <div className="rounded-lg p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: C.blue }}>{drawerFlag.action_taken}</p>
                    <p className="text-sm" style={{ color: C.text }}>{ACTION_EXPLANATIONS[drawerFlag.action_taken] ?? '—'}</p>
                  </div>
                </div>
              )}

              {/* User info */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>User</p>
                <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: C.muted }}>Name</span>
                    <span className="text-xs" style={{ color: C.text }}>{drawerFlag.user_name ?? 'Unknown'}</span>
                  </div>
                  {drawerFlag.user_email && (
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: C.muted }}>Email</span>
                      <span className="text-xs" style={{ color: C.text }}>{drawerFlag.user_email}</span>
                    </div>
                  )}
                  {drawerFlag.user_plan && (
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: C.muted }}>Plan</span>
                      <Badge color={C.muted}>{drawerFlag.user_plan}</Badge>
                    </div>
                  )}
                  {drawerFlag.country_code && (
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: C.muted }}>Country</span>
                      <span className="text-xs" style={{ color: C.text }}>{drawerFlag.country_code}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Session link */}
              {drawerFlag.session_id && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Chat Session</p>
                  <p className="text-xs font-mono" style={{ color: C.blue }}>{drawerFlag.session_id}</p>
                </div>
              )}

              {/* Crisis resources */}
              {drawerFlag.layer_caught === 'crisis' && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Crisis Resources ({drawerFlag.country_code ?? 'Default'})</p>
                  <div className="flex flex-col gap-2">
                    {crisisResources.map((r) => (
                      <div key={r.name} className="rounded-lg p-3" style={{ background: '#f8514910', border: `1px solid #f8514930` }}>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: C.red }}>{r.name}</p>
                        <p className="text-xs" style={{ color: C.text }}>📞 {r.phone}</p>
                        {r.text && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{r.text}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Original response (false positive review) */}
              {drawerFlag.original_response && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Original AI Response (replaced)</p>
                  <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ background: C.bg, border: `1px solid ${C.amber}`, color: C.amber }}>
                    {drawerFlag.original_response}
                  </div>
                </div>
              )}

              {/* Review status */}
              {isReviewed(drawerFlag) && (
                <div className="rounded-lg p-3" style={{ background: '#3fb95010', border: `1px solid #3fb95030` }}>
                  <p className="text-xs" style={{ color: C.green }}>
                    ✓ Reviewed {drawerFlag.reviewed_at ? `on ${new Date(drawerFlag.reviewed_at).toLocaleString()}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Drawer actions */}
            <div className="px-6 py-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              {!isReviewed(drawerFlag) && (
                <Btn
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await markFlagReviewed(drawerFlag.id)
                      setReviewedIds((prev) => new Set([...prev, drawerFlag.id]))
                    })
                  }
                >
                  {isPending ? 'Saving…' : 'Mark as Reviewed'}
                </Btn>
              )}
              {drawerFlag.original_response && !markedFP.has(drawerFlag.id) && (
                <Btn
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await markFalsePositive(drawerFlag.id, drawerFlag.original_response ?? '')
                      setMarkedFP((prev) => new Set([...prev, drawerFlag.id]))
                    })
                  }
                >
                  Mark as False Positive
                </Btn>
              )}
              <Link href={`/users/${drawerFlag.user_id}`}>
                <button className="w-full px-4 py-2 rounded text-sm" style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}>
                  View User Profile →
                </button>
              </Link>
              <button
                className="w-full px-4 py-2 rounded text-sm"
                style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}
                onClick={() => exportFlagJSON(drawerFlag)}
              >
                Export Flag as JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
