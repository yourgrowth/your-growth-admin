'use client'

import { useState, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import {
  flagSummary,
  unflagSummary,
  deleteSummary,
  testPrompt,
  savePromptVersion,
  getSummaryForVersion,
  setActiveVersion,
  updateQualityScore,
} from '@/app/actions/gardener'

export type EnrichedSummary = {
  id: string
  user_id: string
  summary: string | null
  phase: string | null
  prompt_version: string | null
  flagged: boolean | null
  quality_score: number | null
  created_at: string
  user_name: string | null
}

type PromptVersion = {
  id: string
  version_label: string
  prompt_text: string
  created_by: string | null
  created_at: string
}

type Profile = {
  id: string
  full_name: string | null
}

type Tab = 'summaries' | 'sandbox' | 'compare' | 'context' | 'comparison' | 'reengagement' | 'gaps' | 'correlation'
type Filter = 'all' | 'flagged' | 'unrated'

type ContextSnapshot = Record<string, unknown>
type UserModel = Record<string, unknown>

type Props = {
  summaries: EnrichedSummary[]
  profiles: Profile[]
  promptVersions: PromptVersion[]
  contextSnapshots: ContextSnapshot[]
  userModels: UserModel[]
}

function StarRating({ score, summaryId }: { score: number | null; summaryId: string }) {
  const [localScore, setLocalScore] = useState(score)
  const [hovered, setHovered] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasError, setHasError] = useState(false)

  const displayScore = hovered ?? localScore

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={isPending}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => {
            setLocalScore(n)
            setHasError(false)
            startTransition(async () => {
              try {
                await updateQualityScore(summaryId, n)
              } catch {
                setHasError(true)
              }
            })
          }}
          style={{
            color: displayScore !== null && n <= displayScore ? '#d29922' : '#1a2332',
            fontSize: '1rem',
            background: 'none',
            border: 'none',
            cursor: isPending ? 'default' : 'pointer',
            padding: '0 1px',
            opacity: isPending ? 0.5 : 1,
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
      {hasError && (
        <span style={{ color: '#f85149', fontSize: '0.65rem', marginLeft: '2px' }}>!</span>
      )}
    </div>
  )
}

function SummaryCard({ summary: s }: { summary: EnrichedSummary }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: '#0d1117',
        border: `1px solid ${s.flagged ? '#f85149' : '#1a2332'}`,
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>
            {s.user_name ?? 'Unknown User'}
          </span>
          {s.phase && <Badge color="#58a6ff">{s.phase}</Badge>}
          {s.prompt_version && <Badge color="#7d8fa3">v{s.prompt_version}</Badge>}
          {s.flagged && <Badge color="#f85149">Flagged</Badge>}
        </div>
        <span className="text-xs shrink-0 whitespace-nowrap" style={{ color: '#7d8fa3' }}>
          {new Date(s.created_at).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: '#7d8fa3' }}>
        {s.summary ?? 'No summary text'}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Btn
            variant={s.flagged ? 'ghost' : 'danger'}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                if (s.flagged) await unflagSummary(s.id)
                else await flagSummary(s.id)
              })
            }
          >
            {s.flagged ? 'Unflag' : 'Flag'}
          </Btn>
          <Btn
            variant="danger"
            disabled={isPending}
            onClick={() => startTransition(async () => { await deleteSummary(s.id) })}
          >
            Delete
          </Btn>
        </div>
        <StarRating score={s.quality_score} summaryId={s.id} />
      </div>
    </div>
  )
}

function SummariesTab({ summaries }: { summaries: EnrichedSummary[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = summaries.filter((s) => {
    if (filter === 'flagged') return s.flagged
    if (filter === 'unrated') return s.quality_score == null
    return true
  })

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {(['all', 'flagged', 'unrated'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{
                background: filter === f ? '#1a2332' : 'transparent',
                color: filter === f ? '#e6edf3' : '#7d8fa3',
                border: `1px solid ${filter === f ? '#3fb950' : '#1a2332'}`,
              }}
            >
              {f === 'all' ? 'All' : f === 'flagged' ? 'Flagged' : 'Unrated'}
            </button>
          ))}
        </div>
        <button
          onClick={() => { window.location.href = '/api/export?table=gardener' }}
          className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
          style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {filtered.length === 0 ? (
          <p className="text-sm" style={{ color: '#7d8fa3' }}>No summaries</p>
        ) : (
          filtered.map((s) => <SummaryCard key={s.id} summary={s} />)
        )}
      </div>
    </>
  )
}

function SandboxTab({
  profiles,
  promptVersions,
}: {
  profiles: Profile[]
  promptVersions: PromptVersion[]
}) {
  const [promptText, setPromptText] = useState(promptVersions[0]?.prompt_text ?? '')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [versionLabel, setVersionLabel] = useState('')
  const [isSaving, startSaving] = useTransition()
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleTest() {
    if (!promptText.trim() || !selectedUserId) return
    setTestError(null)
    setTestResult(null)
    startTransition(async () => {
      try {
        const result = await testPrompt(promptText, selectedUserId)
        setTestResult(result?.summary ?? JSON.stringify(result))
      } catch (e) {
        setTestError(e instanceof Error ? e.message : 'Test failed')
      }
    })
  }

  function handleSave() {
    if (!versionLabel.trim() || !promptText.trim()) return
    setSavedMsg(null)
    setSaveError(null)
    startSaving(async () => {
      try {
        await savePromptVersion(versionLabel, promptText)
        setSavedMsg(`Saved as "${versionLabel}"`)
        setVersionLabel('')
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const fieldStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #1a2332',
    color: '#e6edf3',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: '680px' }}>
      <div>
        <label className="block text-xs mb-2" style={{ color: '#7d8fa3' }}>
          Prompt
        </label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={10}
          className="rounded-lg p-3 text-sm resize-y"
          style={fieldStyle}
          placeholder="Enter prompt text to test..."
        />
      </div>

      <div>
        <label className="block text-xs mb-2" style={{ color: '#7d8fa3' }}>
          Test User
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ ...fieldStyle, color: selectedUserId ? '#e6edf3' : '#7d8fa3' }}
        >
          <option value="">Select a user...</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Btn
          variant="primary"
          disabled={isPending || !promptText.trim() || !selectedUserId}
          onClick={handleTest}
        >
          {isPending ? 'Running...' : 'Run Test'}
        </Btn>
      </div>

      {testError && (
        <p className="text-sm" style={{ color: '#f85149' }}>{testError}</p>
      )}

      {testResult && (
        <div
          className="rounded-lg p-5"
          style={{ background: '#0d1117', border: '1px solid #3fb950' }}
        >
          <p className="text-xs mb-3 font-medium" style={{ color: '#3fb950' }}>
            Preview
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#e6edf3' }}>
            {testResult}
          </p>
        </div>
      )}

      <div style={{ borderTop: '1px solid #1a2332', paddingTop: '1.5rem' }}>
        <p className="text-xs mb-3" style={{ color: '#7d8fa3' }}>
          Save as New Version
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            placeholder="Version label (e.g. v2.1)"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ ...fieldStyle, flex: 1, width: 'auto' }}
          />
          <Btn
            variant="ghost"
            disabled={isSaving || !versionLabel.trim() || !promptText.trim()}
            onClick={handleSave}
          >
            {isSaving ? 'Saving...' : 'Save as New Version'}
          </Btn>
        </div>
        {savedMsg && (
          <p className="text-xs mt-2" style={{ color: '#3fb950' }}>{savedMsg}</p>
        )}
        {saveError && (
          <p className="text-xs mt-2" style={{ color: '#f85149' }}>{saveError}</p>
        )}
      </div>
    </div>
  )
}

type CompareSummary = {
  id: string
  user_id: string
  summary: string | null
  prompt_version: string | null
  created_at: string
} | null

function CompareTab({
  promptVersions,
  profiles,
}: {
  promptVersions: PromptVersion[]
  profiles: Profile[]
}) {
  const [versionA, setVersionA] = useState('')
  const [versionB, setVersionB] = useState('')
  const [summaryA, setSummaryA] = useState<CompareSummary>(null)
  const [summaryB, setSummaryB] = useState<CompareSummary>(null)
  const [isPending, startTransition] = useTransition()
  const [activePending, startActiveTransition] = useTransition()
  const [activeMsg, setActiveMsg] = useState<string | null>(null)

  const nameMap = new Map(profiles.map((p) => [p.id, p.full_name]))

  function handleCompare() {
    if (!versionA || !versionB) return
    startTransition(async () => {
      const [a, b] = await Promise.all([
        getSummaryForVersion(versionA),
        getSummaryForVersion(versionB),
      ])
      setSummaryA(a as CompareSummary)
      setSummaryB(b as CompareSummary)
    })
  }

  function handleSetActive(version: string) {
    setActiveMsg(null)
    startActiveTransition(async () => {
      await setActiveVersion(version)
      setActiveMsg(`Active version set to "${version}"`)
    })
  }

  const selectStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #1a2332',
    outline: 'none',
    width: '100%',
  }

  const panels = [
    { version: versionA, summary: summaryA },
    { version: versionB, summary: summaryB },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 items-end">
        <div style={{ flex: 1 }}>
          <label className="block text-xs mb-2" style={{ color: '#7d8fa3' }}>
            Version A
          </label>
          <select
            value={versionA}
            onChange={(e) => setVersionA(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ ...selectStyle, color: versionA ? '#e6edf3' : '#7d8fa3' }}
          >
            <option value="">Select version...</option>
            {promptVersions.map((v) => (
              <option key={v.id} value={v.version_label}>
                {v.version_label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm pb-2" style={{ color: '#7d8fa3' }}>
          vs
        </span>

        <div style={{ flex: 1 }}>
          <label className="block text-xs mb-2" style={{ color: '#7d8fa3' }}>
            Version B
          </label>
          <select
            value={versionB}
            onChange={(e) => setVersionB(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ ...selectStyle, color: versionB ? '#e6edf3' : '#7d8fa3' }}
          >
            <option value="">Select version...</option>
            {promptVersions.map((v) => (
              <option key={v.id} value={v.version_label}>
                {v.version_label}
              </option>
            ))}
          </select>
        </div>

        <div className="pb-0.5">
          <Btn
            variant="primary"
            disabled={!versionA || !versionB || versionA === versionB || isPending}
            onClick={handleCompare}
          >
            {isPending ? 'Loading...' : 'Compare'}
          </Btn>
        </div>
      </div>

      {activeMsg && (
        <p className="text-sm" style={{ color: '#3fb950' }}>{activeMsg}</p>
      )}

      {(summaryA !== null || summaryB !== null) && (
        <div className="grid grid-cols-2 gap-4">
          {panels.map(({ version, summary }) => (
            <div
              key={version}
              className="rounded-lg p-5 flex flex-col gap-3"
              style={{ background: '#0d1117', border: '1px solid #1a2332' }}
            >
              <div className="flex items-center justify-between">
                <Badge color="#bc8cff">{version}</Badge>
                <Btn
                  variant="ghost"
                  disabled={activePending}
                  onClick={() => handleSetActive(version)}
                >
                  Set as Active
                </Btn>
              </div>

              {summary ? (
                <>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                      {nameMap.get(summary.user_id) ?? 'Unknown User'}
                    </p>
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>
                      {new Date(summary.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#7d8fa3' }}>
                    {summary.summary ?? 'No summary text'}
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>
                  No summary found for this version
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Context Snapshot Tab ───────────────────────────────────────────────────

function ContextSnapshotsTab({ snapshots, onRebuild }: { snapshots: ContextSnapshot[]; onRebuild: (userId: string) => void }) {
  const [drawerSnapshot, setDrawerSnapshot] = useState<ContextSnapshot | null>(null)
  const [rebuildingId, setRebuildingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRebuild(userId: string) {
    setRebuildingId(userId)
    startTransition(async () => {
      onRebuild(userId)
      setRebuildingId(null)
    })
  }

  function DataSourceChecklist({ ctx }: { ctx: Record<string, unknown> }) {
    const sources = [
      { key: 'habit_days', label: 'Habits' },
      { key: 'journal_days', label: 'Journal' },
      { key: 'nutrition_days', label: 'Nutrition' },
      { key: 'body_log_days', label: 'Body logs' },
      { key: 'goal_days', label: 'Goals' },
      { key: 'water_days', label: 'Water' },
      { key: 'video_days', label: 'Growth Bible' },
    ]
    return (
      <div className="flex flex-col gap-1">
        {sources.map(({ key, label }) => {
          const days = Number(ctx[key] ?? 0)
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span style={{ color: days > 0 ? '#3fb950' : '#1a2332' }}>
                {days > 0 ? '✓' : '○'}
              </span>
              <span style={{ color: days > 0 ? '#e6edf3' : '#7d8fa3' }}>
                {label} {days > 0 ? `(${days}d)` : ''}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {snapshots.length === 0 ? (
        <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#7d8fa3' }}>
          No context snapshots found. They are built by the rebuild-gardener-context edge function.
        </div>
      ) : (
        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                {['User', 'Email', 'Generated', 'Expires', 'Active Day %', 'Confidence', 'Total Days', ''].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s, i) => {
                const activePct = Math.round(Number(s.active_day_rate ?? 0) * 100)
                const confidence = Math.round(Number(s.data_confidence_score ?? 0))
                const lowConfidence = confidence < 30 || Number(s.total_active_days ?? 0) < 14
                return (
                  <tr
                    key={String(s.id ?? i)}
                    style={{ background: '#080b0f', borderBottom: i < snapshots.length - 1 ? '1px solid #1a2332' : undefined, cursor: 'pointer' }}
                    onClick={() => setDrawerSnapshot(s)}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#e6edf3' }}>{String(s.user_name ?? '—')}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{String(s.user_email ?? '—')}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                      {s.generated_at ? new Date(String(s.generated_at)).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                      {s.expires_at ? new Date(String(s.expires_at)).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: activePct < 30 ? '#f85149' : activePct < 60 ? '#d29922' : '#3fb950' }}>
                      {activePct}%
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium" style={{ color: lowConfidence ? '#f85149' : confidence < 60 ? '#d29922' : '#3fb950' }}>
                        {confidence}
                        {lowConfidence && ' ⚠'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                      {String(s.total_active_days ?? '—')}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={isPending && rebuildingId === String(s.user_id)}
                        onClick={() => handleRebuild(String(s.user_id))}
                        className="px-2.5 py-1 rounded text-xs disabled:opacity-50"
                        style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
                      >
                        {rebuildingId === String(s.user_id) ? 'Rebuilding…' : 'Rebuild'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {drawerSnapshot && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDrawerSnapshot(null)}>
          <div className="flex-1" />
          <div
            className="flex flex-col h-full overflow-y-auto"
            style={{ width: 560, background: '#0d1117', borderLeft: '1px solid #1a2332' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a2332' }}>
              <div>
                <p className="font-medium" style={{ color: '#e6edf3' }}>{String(drawerSnapshot.user_name ?? 'Unknown')}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>{String(drawerSnapshot.user_email ?? '—')}</p>
              </div>
              <button onClick={() => setDrawerSnapshot(null)} style={{ color: '#7d8fa3', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div className="flex flex-col gap-5 p-5">
              {/* Data sources */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>Data Sources</p>
                <DataSourceChecklist ctx={(drawerSnapshot.context_json as Record<string, unknown>) ?? {}} />
              </div>

              {/* Activity timeline */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>Activity Rate</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full h-2" style={{ background: '#1a2332' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.round(Number(drawerSnapshot.active_day_rate ?? 0) * 100)}%`,
                        background: '#3fb950',
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#3fb950' }}>
                    {Math.round(Number(drawerSnapshot.active_day_rate ?? 0) * 100)}% active days
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>
                  {String(drawerSnapshot.total_active_days ?? 0)} total active days · confidence {String(drawerSnapshot.data_confidence_score ?? 0)}
                </p>
              </div>

              {/* All-time correlations */}
              {(() => {
                const ctx = (drawerSnapshot.context_json as Record<string, unknown>) ?? {}
                const allTime = (ctx.all_time as Record<string, unknown>) ?? {}
                const correlations = (allTime.correlations as Array<Record<string, unknown>>) ?? []
                const top5 = correlations.slice(0, 5)
                if (top5.length === 0) return null
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>Top All-Time Correlations</p>
                    <div className="flex flex-col gap-2">
                      {top5.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span style={{ color: '#e6edf3' }}>{String(c.metric_a ?? '?')} × {String(c.metric_b ?? '?')}</span>
                          <span style={{ color: '#3fb950' }}>r={Number(c.strength ?? 0).toFixed(2)} ({String(c.data_points ?? '?')}pts)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Recent correlations */}
              {(() => {
                const ctx = (drawerSnapshot.context_json as Record<string, unknown>) ?? {}
                const recent = (ctx.recent_30 as Record<string, unknown>) ?? {}
                const correlations = (recent.correlations as Array<Record<string, unknown>>) ?? []
                const top3 = correlations.slice(0, 3)
                if (top3.length === 0) return null
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>Emerging Recent Correlations (30d)</p>
                    <div className="flex flex-col gap-2">
                      {top3.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span style={{ color: '#e6edf3' }}>{String(c.metric_a ?? '?')} × {String(c.metric_b ?? '?')}</span>
                          <span style={{ color: '#58a6ff' }}>r={Number(c.strength ?? 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* All-time averages */}
              {(() => {
                const ctx = (drawerSnapshot.context_json as Record<string, unknown>) ?? {}
                const allTime = (ctx.all_time as Record<string, unknown>) ?? {}
                const recent = (ctx.recent_30 as Record<string, unknown>) ?? {}
                const fields = [
                  { label: 'Mood avg', allKey: 'mood_avg', recentKey: 'mood_avg' },
                  { label: 'Energy avg', allKey: 'energy_avg', recentKey: 'energy_avg' },
                  { label: 'Habit completion', allKey: 'habit_completion_rate', recentKey: 'habit_completion_rate' },
                ]
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>All-Time vs Recent (30d)</p>
                    <div className="flex flex-col gap-2">
                      {fields.map(({ label, allKey, recentKey }) => {
                        const allVal = Number(allTime[allKey] ?? 0)
                        const recentVal = Number(recent[recentKey] ?? 0)
                        const delta = allVal > 0 ? ((recentVal - allVal) / allVal) * 100 : 0
                        const isRate = allKey.includes('rate')
                        const fmt = (v: number) => isRate ? `${Math.round(v * 100)}%` : v.toFixed(1)
                        return (
                          <div key={label} className="flex items-center justify-between text-xs">
                            <span style={{ color: '#7d8fa3' }}>{label}</span>
                            <span style={{ color: '#e6edf3' }}>
                              {fmt(allVal)} → {fmt(recentVal)}
                              {allVal > 0 && (
                                <span className="ml-2" style={{ color: delta < -15 ? '#f85149' : delta > 0 ? '#3fb950' : '#7d8fa3' }}>
                                  {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                                </span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── All-Time vs Recent Comparison Tab ──────────────────────────────────────

function ComparisonTab({ snapshots }: { snapshots: ContextSnapshot[] }) {
  const fields = [
    { label: 'Mood avg', allKey: 'mood_avg', recentKey: 'mood_avg', isRate: false },
    { label: 'Energy avg', allKey: 'energy_avg', recentKey: 'energy_avg', isRate: false },
    { label: 'Habit completion', allKey: 'habit_completion_rate', recentKey: 'habit_completion_rate', isRate: true },
  ]

  const rows = snapshots.map((s) => {
    const ctx = (s.context_json as Record<string, unknown>) ?? {}
    const allTime = (ctx.all_time as Record<string, unknown>) ?? {}
    const recent = (ctx.recent_30 as Record<string, unknown>) ?? {}
    const flags: string[] = []
    for (const { allKey, recentKey } of fields) {
      const a = Number(allTime[allKey] ?? 0)
      const r = Number(recent[recentKey] ?? 0)
      if (a > 0 && ((r - a) / a) * 100 < -15) flags.push(allKey)
    }
    return { s, allTime, recent, flags }
  })

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 && (
        <p className="text-xs" style={{ color: '#7d8fa3' }}>No context snapshots to compare</p>
      )}
      {rows.map(({ s, allTime, recent, flags }, i) => (
        <div
          key={String(s.id ?? i)}
          className="rounded-lg p-5"
          style={{ background: '#0d1117', border: `1px solid ${flags.length > 0 ? '#f85149' : '#1a2332'}` }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{String(s.user_name ?? '—')}</p>
              <p className="text-xs" style={{ color: '#7d8fa3' }}>{String(s.user_email ?? '—')}</p>
            </div>
            {flags.length > 0 && (
              <span className="text-xs px-2 py-1 rounded" style={{ background: '#f8514922', color: '#f85149', border: '1px solid #f85149' }}>
                ↓ {flags.length} metric{flags.length > 1 ? 's' : ''} dropped &gt;15%
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {fields.map(({ label, allKey, recentKey, isRate }) => {
              const a = Number(allTime[allKey] ?? 0)
              const r = Number(recent[recentKey] ?? 0)
              const delta = a > 0 ? ((r - a) / a) * 100 : 0
              const dropped = a > 0 && delta < -15
              const fmt = (v: number) => isRate ? `${Math.round(v * 100)}%` : v.toFixed(1)
              return (
                <div key={label} className="rounded-lg p-3" style={{ background: '#080b0f', border: `1px solid ${dropped ? '#f85149' : '#1a2332'}` }}>
                  <p className="text-xs mb-2" style={{ color: '#7d8fa3' }}>{label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: '#7d8fa3' }}>{fmt(a)}</span>
                    <span style={{ color: '#7d8fa3' }}>→</span>
                    <span className="text-sm font-medium" style={{ color: dropped ? '#f85149' : '#e6edf3' }}>{fmt(r)}</span>
                    {a > 0 && (
                      <span className="text-xs ml-1" style={{ color: delta < -15 ? '#f85149' : delta > 0 ? '#3fb950' : '#7d8fa3' }}>
                        {delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Re-Engagement Tracker Tab ──────────────────────────────────────────────

function ReEngagementTab({ userModels }: { userModels: UserModel[] }) {
  const returning = userModels.filter((m) => m.currently_returning === true)

  if (returning.length === 0) {
    return (
      <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#7d8fa3' }}>
        No users currently returning from a gap
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
            {['User', 'Gap Days', 'Days Back', 'Pre-gap Mood', 'Post-gap Mood', 'Pre-gap Habits', 'Post-gap Habits', 'Trend'].map((col) => (
              <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {returning.map((m, i) => {
            const preGapMood = Number(m.pre_gap_mood_avg ?? 0)
            const postGapMood = Number(m.post_gap_mood_avg ?? 0)
            const preGapHabits = Number(m.pre_gap_habit_rate ?? 0)
            const postGapHabits = Number(m.post_gap_habit_rate ?? 0)

            const moodDelta = preGapMood > 0 ? postGapMood - preGapMood : 0
            const habitDelta = preGapHabits > 0 ? postGapHabits - preGapHabits : 0
            const overallPositive = moodDelta >= 0 && habitDelta >= -0.05
            const overallNegative = moodDelta < -0.3 || habitDelta < -0.15

            return (
              <tr key={String(m.user_id ?? i)} style={{ background: '#080b0f', borderBottom: i < returning.length - 1 ? '1px solid #1a2332' : undefined }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: '#e6edf3' }}>{String(m.user_name ?? '—')}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: '#d29922' }}>{String(m.gap_days ?? '—')}d</td>
                <td className="px-4 py-2.5" style={{ color: '#3fb950' }}>{String(m.days_back ?? '—')}d</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                  {preGapMood > 0 ? preGapMood.toFixed(1) : '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                  {postGapMood > 0 ? postGapMood.toFixed(1) : '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                  {preGapHabits > 0 ? `${Math.round(preGapHabits * 100)}%` : '—'}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                  {postGapHabits > 0 ? `${Math.round(postGapHabits * 100)}%` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {overallNegative ? (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#d2992222', color: '#d29922', border: '1px solid #d29922' }}>
                      lower_than_before
                    </span>
                  ) : overallPositive ? (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb950' }}>
                      better_than_before
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a2332', color: '#7d8fa3', border: '1px solid #1a2332' }}>
                      similar
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Gap Detection Tab ──────────────────────────────────────────────────────

function GapDetectionTab({ snapshots }: { snapshots: ContextSnapshot[] }) {
  function exportCSV(rows: ContextSnapshot[]) {
    const lines = [
      'user_name,user_email,active_day_rate,total_active_days,data_confidence_score',
      ...rows.map((r) =>
        `"${String(r.user_name ?? '')}","${String(r.user_email ?? '')}",${Number(r.active_day_rate ?? 0).toFixed(2)},${String(r.total_active_days ?? 0)},${String(r.data_confidence_score ?? 0)}`
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gap_detection.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const lowActivity = snapshots.filter((s) => Number(s.active_day_rate ?? 0) < 0.3)
  const lowData = snapshots.filter((s) => Number(s.total_active_days ?? 0) < 14)
  const combined = [...new Set([...lowActivity, ...lowData])]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active day rate < 30%', value: lowActivity.length, color: '#f85149' },
          { label: 'Total active days < 14', value: lowData.length, color: '#d29922' },
          { label: 'Either flag', value: combined.length, color: '#e6edf3' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: '#7d8fa3' }}>Users with low activity rate or low data volume</p>
        <button
          onClick={() => exportCSV(combined)}
          className="px-3 py-1.5 rounded text-xs"
          style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
        >
          Export CSV
        </button>
      </div>

      {combined.length === 0 ? (
        <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#7d8fa3' }}>
          No users flagged for gaps
        </div>
      ) : (
        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                {['User', 'Email', 'Active Day Rate', 'Total Active Days', 'Confidence', 'Flags'].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {combined.map((s, i) => {
                const activePct = Math.round(Number(s.active_day_rate ?? 0) * 100)
                const totalDays = Number(s.total_active_days ?? 0)
                const flags = []
                if (activePct < 30) flags.push('low activity rate')
                if (totalDays < 14) flags.push('low data volume')
                return (
                  <tr key={String(s.user_id ?? i)} style={{ background: '#080b0f', borderBottom: i < combined.length - 1 ? '1px solid #1a2332' : undefined }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#e6edf3' }}>{String(s.user_name ?? '—')}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{String(s.user_email ?? '—')}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: activePct < 30 ? '#f85149' : '#7d8fa3' }}>{activePct}%</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: totalDays < 14 ? '#d29922' : '#7d8fa3' }}>{totalDays}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>{String(s.data_confidence_score ?? '—')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {flags.map((f) => (
                          <span key={f} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f8514922', color: '#f85149', border: '1px solid #f8514944' }}>{f}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Correlation Confidence Tab ──────────────────────────────────────────────

function CorrelationTab({ snapshots }: { snapshots: ContextSnapshot[] }) {
  type CorrelationRow = {
    userId: string
    userName: string
    strongestCorr: string
    dataPoints: number
    confidence: number
    healthScore: number
    lowPoints: boolean
    activePct: number
  }

  const rows: CorrelationRow[] = snapshots.map((s) => {
    const ctx = (s.context_json as Record<string, unknown>) ?? {}
    const allTime = (ctx.all_time as Record<string, unknown>) ?? {}
    const correlations = (allTime.correlations as Array<Record<string, unknown>>) ?? []
    const strongest = correlations[0]
    const dataPoints = Number(strongest?.data_points ?? 0)
    const confidence = Number(s.data_confidence_score ?? 0)
    const activePct = Math.round(Number(s.active_day_rate ?? 0) * 100)

    // Health score: active_day_rate (40) + confidence (40) + correlation data points (20)
    const healthScore = Math.round(
      activePct * 0.4 +
      Math.min(confidence, 100) * 0.4 +
      Math.min((dataPoints / 30) * 100, 100) * 0.2
    )

    return {
      userId: String(s.user_id ?? ''),
      userName: String(s.user_name ?? '—'),
      strongestCorr: strongest ? `${String(strongest.metric_a ?? '?')} × ${String(strongest.metric_b ?? '?')}` : '—',
      dataPoints,
      confidence,
      healthScore,
      lowPoints: dataPoints > 0 && dataPoints < 10,
      activePct,
    }
  }).sort((a, b) => a.healthScore - b.healthScore)

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 && (
        <p className="text-xs" style={{ color: '#7d8fa3' }}>No snapshot data for correlation analysis</p>
      )}
      <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              {['User', 'Strongest Correlation', 'Data Points', 'Confidence', 'Active Days %', 'Health Score'].map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId} style={{ background: '#080b0f', borderBottom: i < rows.length - 1 ? '1px solid #1a2332' : undefined }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: '#e6edf3' }}>{r.userName}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: '#bc8cff' }}>{r.strongestCorr}</td>
                <td className="px-4 py-2.5">
                  <span className="text-sm font-medium" style={{ color: r.lowPoints ? '#f85149' : '#e6edf3' }}>
                    {r.dataPoints > 0 ? r.dataPoints : '—'}
                    {r.lowPoints && ' ⚠'}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: r.confidence < 30 ? '#f85149' : r.confidence < 60 ? '#d29922' : '#3fb950' }}>
                  {r.confidence}
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: r.activePct < 30 ? '#f85149' : '#7d8fa3' }}>
                  {r.activePct}%
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full" style={{ background: '#1a2332' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${r.healthScore}%`, background: r.healthScore < 40 ? '#f85149' : r.healthScore < 65 ? '#d29922' : '#3fb950' }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: r.healthScore < 40 ? '#f85149' : r.healthScore < 65 ? '#d29922' : '#3fb950' }}>
                      {r.healthScore}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main GardenerClient ─────────────────────────────────────────────────────

export default function GardenerClient({ summaries, profiles, promptVersions, contextSnapshots, userModels }: Props) {
  const [tab, setTab] = useState<Tab>('summaries')

  const flaggedCount = summaries.filter((s) => s.flagged).length
  const versionCount = new Set(summaries.map((s) => s.prompt_version).filter(Boolean)).size
  const ratedSummaries = summaries.filter((s) => s.quality_score != null)
  const avgQuality =
    ratedSummaries.length > 0
      ? (
          ratedSummaries.reduce((sum, s) => sum + (s.quality_score ?? 0), 0) /
          ratedSummaries.length
        ).toFixed(1)
      : '—'

  const [, startRebuild] = useTransition()

  function handleRebuild(userId: string) {
    startRebuild(async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        await admin.functions.invoke('rebuild-gardener-context', { body: { userId } })
      } catch {
        // Edge function call from client — requires service role on server
        // In production, wire this to a server action
      }
    })
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summaries', label: 'Summaries' },
    { id: 'sandbox', label: 'Sandbox' },
    { id: 'compare', label: 'Compare' },
    { id: 'context', label: 'Context Snapshots' },
    { id: 'comparison', label: 'All-Time vs Recent' },
    { id: 'reengagement', label: 'Re-Engagement' },
    { id: 'gaps', label: 'Gap Detection' },
    { id: 'correlation', label: 'Correlation Health' },
  ]

  return (
    <div>
      <PageHeader title="The Gardener" subtitle="AI coaching summaries" />

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Summaries" value={summaries.length} color="#e6edf3" />
        <StatCard label="Flagged" value={flaggedCount} color="#f85149" />
        <StatCard label="Prompt Versions" value={versionCount} color="#bc8cff" />
        <StatCard label="Avg Quality" value={avgQuality} color="#d29922" />
        <StatCard label="Context Snapshots" value={contextSnapshots.length} color="#39d0d8" />
      </div>

      <div className="flex mb-6 overflow-x-auto" style={{ borderBottom: '1px solid #1a2332' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer whitespace-nowrap"
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

      {tab === 'summaries' && <SummariesTab summaries={summaries} />}
      {tab === 'sandbox' && (
        <SandboxTab profiles={profiles} promptVersions={promptVersions} />
      )}
      {tab === 'compare' && (
        <CompareTab promptVersions={promptVersions} profiles={profiles} />
      )}
      {tab === 'context' && (
        <ContextSnapshotsTab snapshots={contextSnapshots} onRebuild={handleRebuild} />
      )}
      {tab === 'comparison' && (
        <ComparisonTab snapshots={contextSnapshots} />
      )}
      {tab === 'reengagement' && (
        <ReEngagementTab userModels={userModels} />
      )}
      {tab === 'gaps' && (
        <GapDetectionTab snapshots={contextSnapshots} />
      )}
      {tab === 'correlation' && (
        <CorrelationTab snapshots={contextSnapshots} />
      )}
    </div>
  )
}
