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

type Tab = 'summaries' | 'sandbox' | 'compare'
type Filter = 'all' | 'flagged' | 'unrated'

type Props = {
  summaries: EnrichedSummary[]
  profiles: Profile[]
  promptVersions: PromptVersion[]
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

export default function GardenerClient({ summaries, profiles, promptVersions }: Props) {
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summaries', label: 'Summaries' },
    { id: 'sandbox', label: 'Sandbox' },
    { id: 'compare', label: 'Compare' },
  ]

  return (
    <div>
      <PageHeader title="The Gardener" subtitle="AI coaching summaries" />

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Summaries" value={summaries.length} color="#e6edf3" />
        <StatCard label="Flagged" value={flaggedCount} color="#f85149" />
        <StatCard label="Prompt Versions" value={versionCount} color="#bc8cff" />
        <StatCard label="Avg Quality" value={avgQuality} color="#d29922" />
        <StatCard label="Saved Versions" value={promptVersions.length} color="#39d0d8" />
      </div>

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

      {tab === 'summaries' && <SummariesTab summaries={summaries} />}
      {tab === 'sandbox' && (
        <SandboxTab profiles={profiles} promptVersions={promptVersions} />
      )}
      {tab === 'compare' && (
        <CompareTab promptVersions={promptVersions} profiles={profiles} />
      )}
    </div>
  )
}
