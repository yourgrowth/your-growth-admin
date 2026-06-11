'use client'

import { useState, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import ProgressBar from '@/components/ui/ProgressBar'
import type { Playlist, ContentAbTest } from '@/types/database'
import type { VideoWithStats, SuggestedPlaylist } from './page'
import {
  publishVideo,
  unpublishVideo,
  deleteVideo,
  addVideo,
  createPlaylist,
  createAbTest,
  endAbTest,
} from '@/app/actions/content'

type Props = {
  videosWithStats: VideoWithStats[]
  suggestedPlaylists: SuggestedPlaylist[]
  playlists: Playlist[]
  abTests: ContentAbTest[]
}

const C = {
  bg: '#080b0f',
  surface: '#0d1117',
  border: '#1a2332',
  text: '#e6edf3',
  muted: '#7d8fa3',
  green: '#3fb950',
  blue: '#58a6ff',
  purple: '#bc8cff',
  amber: '#d29922',
  red: '#f85149',
  cyan: '#39d0d8',
} as const

const inp: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, color: C.text }

function getWinner(test: ContentAbTest): 'a' | 'b' | null {
  if (test.variant_a_views > test.variant_b_views * 1.1) return 'a'
  if (test.variant_b_views > test.variant_a_views * 1.1) return 'b'
  return null
}

type Tab = 'videos' | 'playlists' | 'abtests' | 'performance' | 'correlation'
const TABS: { key: Tab; label: string }[] = [
  { key: 'videos', label: 'Videos' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'abtests', label: 'A/B Tests' },
  { key: 'performance', label: 'Performance' },
  { key: 'correlation', label: 'Outcomes' },
]

export default function ContentClient({ videosWithStats, suggestedPlaylists, playlists, abTests }: Props) {
  const [tab, setTab] = useState<Tab>('videos')
  const [isPending, startTransition] = useTransition()

  // Videos
  const [showAddForm, setShowAddForm] = useState(false)
  const [title, setTitle] = useState('')
  const [muxId, setMuxId] = useState('')
  const [duration, setDuration] = useState('')
  const [drawer, setDrawer] = useState<VideoWithStats | null>(null)

  // A/B Tests
  const [showAbForm, setShowAbForm] = useState(false)
  const [abVideoId, setAbVideoId] = useState('')
  const [abVariantA, setAbVariantA] = useState('')
  const [abVariantB, setAbVariantB] = useState('')

  const videoMap = new Map(videosWithStats.map(v => [v.id, v.title]))
  const publishedCount = videosWithStats.filter(v => v.is_published).length
  const draftCount = videosWithStats.filter(v => !v.is_published).length

  function handleAddVideo() {
    if (!title.trim()) return
    startTransition(async () => {
      await addVideo(title.trim(), muxId.trim(), Number(duration) || 0)
      setTitle(''); setMuxId(''); setDuration(''); setShowAddForm(false)
    })
  }

  function handleCreateAbTest() {
    if (!abVideoId || !abVariantA.trim() || !abVariantB.trim()) return
    startTransition(async () => {
      await createAbTest(abVideoId, abVariantA.trim(), abVariantB.trim())
      setAbVideoId(''); setAbVariantA(''); setAbVariantB(''); setShowAbForm(false)
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <PageHeader title="Growth Bible" subtitle={`${publishedCount} published Â· ${draftCount} draft`} />
        <div className="pt-1">
          {tab === 'videos' && (
            <Btn onClick={() => setShowAddForm(v => !v)}>{showAddForm ? 'Cancel' : '+ Add Video'}</Btn>
          )}
          {tab === 'abtests' && (
            <Btn onClick={() => setShowAbForm(v => !v)}>{showAbForm ? 'Cancel' : '+ Create Test'}</Btn>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-6" style={{ borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t.key ? C.text : C.muted,
              borderBottom: tab === t.key ? `2px solid ${C.blue}` : '2px solid transparent',
              marginBottom: '-1px',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ VIDEOS TAB â”€â”€ */}
      {tab === 'videos' && (
        <>
          {showAddForm && (
            <div className="rounded-lg p-5 mb-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-sm font-semibold mb-4" style={{ color: C.text }}>New Video</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: C.muted }}>Title *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded px-3 py-2 text-sm outline-none" style={inp} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: C.muted }}>Mux Playback ID</label>
                  <input value={muxId} onChange={e => setMuxId(e.target.value)} className="w-full rounded px-3 py-2 text-sm outline-none" style={inp} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: C.muted }}>Duration (seconds)</label>
                  <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full rounded px-3 py-2 text-sm outline-none" style={inp} />
                </div>
              </div>
              <Btn onClick={handleAddVideo} disabled={isPending || !title.trim()}>
                {isPending ? 'Addingâ€¦' : 'Add Video'}
              </Btn>
            </div>
          )}

          <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${C.border}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  {['Title', 'Duration', 'Avg Watch %', 'Completion Rate', 'Status', 'Actions'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: C.muted }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {videosWithStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: C.muted, background: C.bg }}>
                      No videos
                    </td>
                  </tr>
                ) : (
                  videosWithStats.map((v, i) => (
                    <tr key={v.id} style={{ background: C.bg, borderBottom: i < videosWithStats.length - 1 ? `1px solid ${C.border}` : undefined }}>
                      <td className="px-4 py-3">
                        <button className="text-left hover:underline" style={{ color: C.blue }} onClick={() => setDrawer(v)}>
                          {v.title}
                        </button>
                      </td>
                      <td className="px-4 py-3" style={{ color: C.text }}>
                        {v.duration_seconds != null ? `${v.duration_seconds}s` : 'â€”'}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: v.avg_watch_pct != null ? C.cyan : C.muted }}>
                        {v.avg_watch_pct != null ? `${v.avg_watch_pct}%` : 'â€”'}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: v.completion_rate != null ? C.green : C.muted }}>
                        {v.completion_rate != null ? `${v.completion_rate}%` : 'â€”'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={v.is_published ? C.green : C.muted}>
                          {v.is_published ? 'published' : 'draft'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Btn variant="ghost" disabled={isPending} onClick={() => startTransition(async () => {
                            if (v.is_published) await unpublishVideo(v.id)
                            else await publishVideo(v.id)
                          })}>
                            {v.is_published ? 'Unpublish' : 'Publish'}
                          </Btn>
                          <Btn variant="danger" disabled={isPending} onClick={() => startTransition(async () => { await deleteVideo(v.id) })}>
                            Delete
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* â”€â”€ PLAYLISTS TAB â”€â”€ */}
      {tab === 'playlists' && (
        <div className="space-y-8">
          <div className="rounded-lg p-6 text-center" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
            <p className="text-sm font-medium mb-1" style={{ color: C.text }}>Playlists â€” Coming Soon</p>
            <p className="text-xs" style={{ color: C.muted }}>
              Curated playlists will be available once the playlists feature is built. Suggested playlists from co-watch data are shown below.
            </p>
          </div>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.muted }}>
              Suggested Playlists (auto-generated from co-watch data)
            </h2>
            {suggestedPlaylists.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>
                Not enough watch history to suggest playlists yet.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestedPlaylists.map((sp, i) => (
                  <div key={i} className="rounded-lg p-4 flex items-center justify-between gap-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: C.text }}>{sp.name}</p>
                      <p className="text-xs" style={{ color: C.muted }}>
                        {sp.videoIds.length} videos Â· appeared in {sp.count} session{sp.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Btn variant="ghost" disabled={isPending} onClick={() => startTransition(async () => {
                      await createPlaylist(sp.name, sp.videoIds)
                    })}>
                      Save Playlist
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}

      {/* â”€â”€ A/B TESTS TAB â”€â”€ */}
      {tab === 'abtests' && (
        <div className="space-y-6">
          <div className="rounded-lg p-6 text-center" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
            <p className="text-sm font-medium mb-1" style={{ color: C.text }}>A/B Tests â€” Coming Soon</p>
            <p className="text-xs" style={{ color: C.muted }}>
              Title variant testing will be available in a future release. No A/B test data is being collected yet.
            </p>
          </div>

          {false && (
            <div className="space-y-3">
              {abTests.map(test => {
                const winner = getWinner(test)
                const videoTitle = videoMap.get(test.video_id ?? '') ?? 'Unknown video'
                return (
                  <div key={test.id} className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs truncate" style={{ color: C.muted }}>{videoTitle}</span>
                          <Badge color={test.status === 'active' ? C.green : C.muted}>{test.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${winner === 'a' ? C.green : C.border}` }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold" style={{ color: C.muted }}>A</span>
                              {winner === 'a' && <span className="text-xs" style={{ color: C.green }}>â˜… Winner</span>}
                            </div>
                            <p className="text-sm mb-1.5" style={{ color: C.text }}>{test.variant_a_title}</p>
                            <p className="text-xs" style={{ color: C.blue }}>{test.variant_a_views.toLocaleString()} views</p>
                          </div>
                          <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${winner === 'b' ? C.green : C.border}` }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold" style={{ color: C.muted }}>B</span>
                              {winner === 'b' && <span className="text-xs" style={{ color: C.green }}>â˜… Winner</span>}
                            </div>
                            <p className="text-sm mb-1.5" style={{ color: C.text }}>{test.variant_b_title}</p>
                            <p className="text-xs" style={{ color: C.blue }}>{test.variant_b_views.toLocaleString()} views</p>
                          </div>
                        </div>
                      </div>
                      {test.status === 'active' && (
                        <div className="pt-1 shrink-0">
                          <Btn variant="ghost" disabled={isPending} onClick={() => startTransition(async () => { await endAbTest(test.id) })}>
                            End Test
                          </Btn>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ PERFORMANCE TAB â”€â”€ */}
      {tab === 'performance' && (
        <div className="flex flex-col gap-6">
          {/* Top line stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const published = videosWithStats.filter((v) => v.is_published)
              const withData = published.filter((v) => v.avg_watch_pct != null)
              const avgWatch = withData.length > 0 ? Math.round(withData.reduce((s, v) => s + (v.avg_watch_pct ?? 0), 0) / withData.length) : null
              const avgCompletion = withData.length > 0 ? Math.round(withData.reduce((s, v) => s + (v.completion_rate ?? 0), 0) / withData.length) : null
              const mostWatched = published.sort((a, b) => (b.avg_watch_pct ?? 0) - (a.avg_watch_pct ?? 0))[0]
              const leastWatched = published.filter((v) => v.avg_watch_pct != null).sort((a, b) => (a.avg_watch_pct ?? 100) - (b.avg_watch_pct ?? 100))[0]
              return (
                <>
                  <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>Avg Watch %</p>
                    <p className="text-2xl font-bold" style={{ color: avgWatch != null ? C.cyan : C.muted }}>{avgWatch != null ? `${avgWatch}%` : 'â€”'}</p>
                  </div>
                  <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>Avg Completion Rate</p>
                    <p className="text-2xl font-bold" style={{ color: avgCompletion != null ? C.green : C.muted }}>{avgCompletion != null ? `${avgCompletion}%` : 'â€”'}</p>
                  </div>
                  <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>Most Watched</p>
                    <p className="text-sm font-medium truncate" style={{ color: C.green }}>{mostWatched?.title ?? 'â€”'}</p>
                    {mostWatched?.avg_watch_pct != null && <p className="text-xs mt-1" style={{ color: C.muted }}>{mostWatched.avg_watch_pct}% avg</p>}
                  </div>
                  <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>Least Watched</p>
                    <p className="text-sm font-medium truncate" style={{ color: C.amber }}>{leastWatched?.title ?? 'â€”'}</p>
                    {leastWatched?.avg_watch_pct != null && <p className="text-xs mt-1" style={{ color: C.muted }}>{leastWatched.avg_watch_pct}% avg</p>}
                  </div>
                </>
              )
            })()}
          </div>

          {/* Per-video bar chart */}
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <div className="px-4 py-3" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Completion Rate by Video (published only)</p>
            </div>
            <div className="p-5 flex flex-col gap-3" style={{ background: C.bg }}>
              {videosWithStats.filter((v) => v.is_published).length === 0 ? (
                <p className="text-xs" style={{ color: C.muted }}>No published videos</p>
              ) : videosWithStats.filter((v) => v.is_published).sort((a, b) => (b.completion_rate ?? 0) - (a.completion_rate ?? 0)).map((v) => (
                <div key={v.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="truncate flex-1 mr-4" style={{ color: C.text }}>{v.title}</span>
                    <span style={{ color: C.muted }}>
                      {v.completion_rate != null ? `${v.completion_rate}%` : 'â€”'}
                      {v.avg_watch_pct != null ? ` Â· ${v.avg_watch_pct}% avg watch` : ''}
                    </span>
                  </div>
                  <ProgressBar
                    value={v.completion_rate ?? 0}
                    color={
                      (v.completion_rate ?? 0) >= 60 ? C.green :
                      (v.completion_rate ?? 0) >= 30 ? C.amber : C.red
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ OUTCOMES / CORRELATION TAB â”€â”€ */}
      {tab === 'correlation' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: C.muted }}>Content Correlation with Outcomes</p>
            <p className="text-xs mb-4" style={{ color: C.muted }}>
              This section will show correlations between video completions and user outcomes (habit streaks, mood, goal progress).
              Data is populated by the intelligence-pipeline edge function via the user_models table.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Growth Bible â†’ Habit Consistency', note: 'Users who complete 3+ videos/week' },
                { label: 'Growth Bible â†’ Mood Score', note: 'Based on journal mood before/after' },
                { label: 'Topic completion â†’ Goal completion', note: 'Same-topic goals' },
                { label: 'Watch time â†’ App retention', note: '30-day active rate' },
              ].map(({ label, note }) => (
                <div key={label} className="rounded-lg p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <p className="text-sm font-medium mb-1" style={{ color: C.text }}>{label}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{note}</p>
                  <p className="text-xs mt-2" style={{ color: C.muted }}>
                    r = â€” Â· <span style={{ color: C.muted }}>requires user_models data</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: C.muted }}>
              Full correlation data will populate once the intelligence pipeline has run for 14+ days.
            </p>
          </div>
        </div>
      )}

      {/* â”€â”€ WATCH DISTRIBUTION DRAWER â”€â”€ */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(8,11,15,0.7)' }}
          onClick={() => setDrawer(null)}
        >
          <div
            className="w-full max-w-md h-full overflow-y-auto p-6"
            style={{ background: C.surface, borderLeft: `1px solid ${C.border}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="pr-4">
                <p className="text-xs mb-1" style={{ color: C.muted }}>Watch Distribution</p>
                <h3 className="text-sm font-semibold leading-snug" style={{ color: C.text }}>{drawer.title}</h3>
              </div>
              <button onClick={() => setDrawer(null)} className="text-2xl leading-none mt-0.5 shrink-0" style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                Ã—
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <p className="text-xs mb-1" style={{ color: C.muted }}>Avg Watch</p>
                <p className="text-xl font-semibold" style={{ color: C.cyan }}>
                  {drawer.avg_watch_pct != null ? `${drawer.avg_watch_pct}%` : 'â€”'}
                </p>
              </div>
              <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <p className="text-xs mb-1" style={{ color: C.muted }}>Completion Rate</p>
                <p className="text-xl font-semibold" style={{ color: C.green }}>
                  {drawer.completion_rate != null ? `${drawer.completion_rate}%` : 'â€”'}
                </p>
              </div>
            </div>

            {drawer.distribution.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>No watch event data for this video yet.</p>
            ) : (
              <div className="space-y-4">
                {drawer.distribution.map(d => (
                  <div key={d.range}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: C.muted }}>{d.range}</span>
                      <span style={{ color: C.text }}>{d.count} view{d.count !== 1 ? 's' : ''}</span>
                    </div>
                    <ProgressBar value={d.pct} color={C.blue} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

