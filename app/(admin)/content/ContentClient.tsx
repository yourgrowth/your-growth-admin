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

type Tab = 'videos' | 'playlists' | 'abtests'
const TABS: { key: Tab; label: string }[] = [
  { key: 'videos', label: 'Videos' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'abtests', label: 'A/B Tests' },
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
        <PageHeader title="Growth Bible" subtitle={`${publishedCount} published · ${draftCount} draft`} />
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

      {/* ── VIDEOS TAB ── */}
      {tab === 'videos' && (
        <>
          {showAddForm && (
            <div className="rounded-lg p-5 mb-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-sm font-semibold mb-4" style={{ color: C.text }}>New Video</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
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
                {isPending ? 'Adding…' : 'Add Video'}
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
                        {v.duration_seconds != null ? `${v.duration_seconds}s` : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: v.avg_watch_pct != null ? C.cyan : C.muted }}>
                        {v.avg_watch_pct != null ? `${v.avg_watch_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: v.completion_rate != null ? C.green : C.muted }}>
                        {v.completion_rate != null ? `${v.completion_rate}%` : '—'}
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

      {/* ── PLAYLISTS TAB ── */}
      {tab === 'playlists' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.muted }}>
              Suggested Playlists
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
                        {sp.videoIds.length} videos · appeared in {sp.count} session{sp.count !== 1 ? 's' : ''}
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

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.muted }}>
              Saved Playlists
            </h2>
            {playlists.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>No playlists saved yet.</p>
            ) : (
              <div className="space-y-3">
                {playlists.map(pl => (
                  <div key={pl.id} className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-sm font-medium mb-1" style={{ color: C.text }}>{pl.name}</p>
                    <p className="text-xs mb-3" style={{ color: C.muted }}>{pl.video_ids.length} video{pl.video_ids.length !== 1 ? 's' : ''}</p>
                    <div className="flex flex-wrap gap-2">
                      {pl.video_ids.map(id => (
                        <span key={id} className="text-xs px-2 py-0.5 rounded" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
                          {videoMap.get(id) ?? id.slice(0, 8) + '…'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── A/B TESTS TAB ── */}
      {tab === 'abtests' && (
        <div className="space-y-6">
          {showAbForm && (
            <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-sm font-semibold mb-4" style={{ color: C.text }}>New A/B Test</p>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: C.muted }}>Video</label>
                  <select value={abVideoId} onChange={e => setAbVideoId(e.target.value)} className="w-full rounded px-3 py-2 text-sm outline-none" style={inp}>
                    <option value="">Select a video…</option>
                    {videosWithStats.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: C.muted }}>Variant A Title</label>
                    <input value={abVariantA} onChange={e => setAbVariantA(e.target.value)} className="w-full rounded px-3 py-2 text-sm outline-none" style={inp} placeholder="Original title" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: C.muted }}>Variant B Title</label>
                    <input value={abVariantB} onChange={e => setAbVariantB(e.target.value)} className="w-full rounded px-3 py-2 text-sm outline-none" style={inp} placeholder="Alternative title" />
                  </div>
                </div>
              </div>
              <Btn onClick={handleCreateAbTest} disabled={isPending || !abVideoId || !abVariantA.trim() || !abVariantB.trim()}>
                {isPending ? 'Creating…' : 'Create Test'}
              </Btn>
            </div>
          )}

          {abTests.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>
              No A/B tests yet. Create one to compare title variants.
            </p>
          ) : (
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
                              {winner === 'a' && <span className="text-xs" style={{ color: C.green }}>★ Winner</span>}
                            </div>
                            <p className="text-sm mb-1.5" style={{ color: C.text }}>{test.variant_a_title}</p>
                            <p className="text-xs" style={{ color: C.blue }}>{test.variant_a_views.toLocaleString()} views</p>
                          </div>
                          <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${winner === 'b' ? C.green : C.border}` }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold" style={{ color: C.muted }}>B</span>
                              {winner === 'b' && <span className="text-xs" style={{ color: C.green }}>★ Winner</span>}
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

      {/* ── WATCH DISTRIBUTION DRAWER ── */}
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
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <p className="text-xs mb-1" style={{ color: C.muted }}>Avg Watch</p>
                <p className="text-xl font-semibold" style={{ color: C.cyan }}>
                  {drawer.avg_watch_pct != null ? `${drawer.avg_watch_pct}%` : '—'}
                </p>
              </div>
              <div className="rounded p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <p className="text-xs mb-1" style={{ color: C.muted }}>Completion Rate</p>
                <p className="text-xl font-semibold" style={{ color: C.green }}>
                  {drawer.completion_rate != null ? `${drawer.completion_rate}%` : '—'}
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
