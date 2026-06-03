'use client'

import { useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { unflagEntry, deleteEntry } from '@/app/actions/journal'

export type MoodGroup = {
  label: string
  emoji: string
  desc: string
  color: string
  count: number
}

export type FlaggedEntry = {
  id: string
  user_name: string | null
  created_at: string
  mood_score: number | null
  content_preview: string | null
}

export type JournalStats = {
  totalToday: number
  activeJournalersCount: number
  totalProfiles: number
  avgMoodScore: number | null
  flaggedCount: number
}

type Props = {
  stats: JournalStats
  moodGroups: MoodGroup[]
  flaggedEntries: FlaggedEntry[]
}

export default function JournalClient({ stats, moodGroups, flaggedEntries }: Props) {
  const [isPending, startTransition] = useTransition()

  const activeJournalersLabel =
    stats.totalProfiles > 0
      ? `${stats.activeJournalersCount} / ${stats.totalProfiles} (${((stats.activeJournalersCount / stats.totalProfiles) * 100).toFixed(1)}%)`
      : `${stats.activeJournalersCount}`

  const maxMoodCount = Math.max(...moodGroups.map((g) => g.count), 1)

  return (
    <div>
      <PageHeader title="Journal" subtitle="User journaling activity and flagged entries" />

      {/* Privacy Banner */}
      <div
        className="rounded-lg px-4 py-3 mb-8 text-sm"
        style={{
          background: '#d2992215',
          border: '1px solid #d2992240',
          color: '#d29922',
        }}
      >
        <span className="font-semibold">Privacy Notice — </span>
        Individual journal entries are private by default. Entry content is only surfaced here
        when an entry has been flagged for review.
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Entries Today" value={stats.totalToday} color="#58a6ff" />
        <StatCard
          label="Active Journalers"
          value={activeJournalersLabel}
          color="#3fb950"
        />
        <StatCard
          label="Average Mood Score"
          value={stats.avgMoodScore != null ? stats.avgMoodScore.toFixed(1) : '—'}
          color="#bc8cff"
        />
        <StatCard label="Flagged Entries" value={stats.flaggedCount} color="#f85149" />
      </div>

      {/* Mood Distribution */}
      <section className="mb-8">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Mood Distribution
        </h2>
        <div
          className="rounded-lg p-5"
          style={{ background: '#0d1117', border: '1px solid #1a2332' }}
        >
          <div className="flex flex-col gap-4">
            {moodGroups.map((g) => (
              <div key={g.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-sm" style={{ color: '#e6edf3' }}>
                  <span className="mr-1.5">{g.emoji}</span>
                  <span>{g.desc}</span>
                </div>
                <div
                  className="h-6 rounded flex-1 relative overflow-hidden"
                  style={{ background: '#1a2332' }}
                >
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${(g.count / maxMoodCount) * 100}%`,
                      background: g.color,
                      opacity: 0.8,
                      minWidth: g.count > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <div className="w-16 text-right shrink-0">
                  <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                    {g.count}
                  </span>
                  <span className="text-xs ml-1" style={{ color: '#7d8fa3' }}>
                    {g.label}
                  </span>
                </div>
              </div>
            ))}
            {moodGroups.every((g) => g.count === 0) && (
              <p className="text-sm text-center py-2" style={{ color: '#7d8fa3' }}>
                No mood data yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Flagged Entries */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Flagged Entries
        </h2>
        {flaggedEntries.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: '#0d1117', border: '1px solid #1a2332' }}
          >
            <p className="text-sm" style={{ color: '#7d8fa3' }}>
              No flagged entries.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {flaggedEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg p-5"
                style={{ background: '#0d1117', border: '1px solid #f8514940' }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                      {entry.user_name ?? 'Unknown User'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge color="#f85149">Flagged</Badge>
                    {entry.mood_score != null && (
                      <Badge color="#bc8cff">Mood {entry.mood_score}</Badge>
                    )}
                  </div>
                </div>
                {entry.content_preview && (
                  <p
                    className="text-xs mb-3 font-mono leading-relaxed rounded p-3"
                    style={{
                      color: '#7d8fa3',
                      background: '#080b0f',
                      border: '1px solid #1a2332',
                    }}
                  >
                    {entry.content_preview}
                    {entry.content_preview.length >= 100 && (
                      <span style={{ color: '#3fb950' }}>…</span>
                    )}
                  </p>
                )}
                <p className="text-xs mb-3 font-mono" style={{ color: '#1a2332' }}>
                  id: {entry.id}
                </p>
                <div className="flex gap-2">
                  <Btn
                    variant="ghost"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await unflagEntry(entry.id)
                      })
                    }
                  >
                    Unflag
                  </Btn>
                  <Btn
                    variant="danger"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteEntry(entry.id)
                      })
                    }
                  >
                    Delete
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
