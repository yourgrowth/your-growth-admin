import { createAdminClient } from '@/lib/supabase/admin'
import ContentClient from './ContentClient'

export type VideoWithStats = {
  id: string
  topic_id: string | null
  title: string
  description: string | null
  mux_playback_id: string | null
  mux_asset_id: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
  sort_order: number | null
  is_free: boolean | null
  is_published: boolean | null
  tags: string[] | null
  created_at: string
  avg_watch_pct: number | null
  completion_rate: number | null
  distribution: { range: string; count: number; pct: number }[]
}

export type SuggestedPlaylist = {
  videoIds: string[]
  count: number
  name: string
}

export default async function ContentPage() {
  const supabase = createAdminClient()

  const [
    { data: videos },
    { data: watchEvents },
    { data: watchHistory },
  ] = await Promise.all([
    supabase.from('growth_bible_videos').select('*').order('sort_order', { ascending: true }),
    supabase.from('video_watch_events').select('video_id, watch_percentage'),
    supabase.from('video_watch_history').select('user_id, video_id, watched_at'),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playlists: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const abTests: any[] = []

  // Per-video watch stats from video_watch_events
  const statsMap = new Map<string, number[]>()
  for (const e of watchEvents ?? []) {
    if (!e.video_id || e.watch_percentage == null) continue
    if (!statsMap.has(e.video_id)) statsMap.set(e.video_id, [])
    statsMap.get(e.video_id)!.push(e.watch_percentage)
  }

  const videosWithStats: VideoWithStats[] = (videos ?? []).map(v => {
    const pcts = statsMap.get(v.id) ?? []
    if (pcts.length === 0) return { ...v, avg_watch_pct: null, completion_rate: null, distribution: [] }
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    const completed = pcts.filter(p => p >= 80).length
    const distribution = [
      { range: '0–25%', count: pcts.filter(p => p <= 25).length },
      { range: '26–50%', count: pcts.filter(p => p > 25 && p <= 50).length },
      { range: '51–75%', count: pcts.filter(p => p > 50 && p <= 75).length },
      { range: '76–100%', count: pcts.filter(p => p > 75).length },
    ].map(d => ({ ...d, pct: (d.count / pcts.length) * 100 }))
    return { ...v, avg_watch_pct: avg, completion_rate: Math.round((completed / pcts.length) * 100), distribution }
  })

  // Co-watch analysis from video_watch_history
  const byUser: Record<string, { video_id: string; ts: number }[]> = {}
  for (const e of watchHistory ?? []) {
    if (!e.user_id || !e.video_id) continue
    if (!byUser[e.user_id]) byUser[e.user_id] = []
    byUser[e.user_id].push({ video_id: e.video_id, ts: new Date(e.watched_at).getTime() })
  }

  const pairCounts: Record<string, number> = {}
  for (const events of Object.values(byUser)) {
    const sorted = [...events].sort((a, b) => a.ts - b.ts)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].ts - sorted[i].ts > 30 * 60 * 1000) break
        const key = [sorted[i].video_id, sorted[j].video_id].sort().join('|')
        pairCounts[key] = (pairCounts[key] ?? 0) + 1
      }
    }
  }

  const videoTitleMap = new Map((videos ?? []).map(v => [v.id, v.title]))
  const suggestedPlaylists: SuggestedPlaylist[] = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const videoIds = key.split('|')
      return { videoIds, count, name: videoIds.map(id => videoTitleMap.get(id) ?? 'Unknown').join(' + ') }
    })

  return (
    <ContentClient
      videosWithStats={videosWithStats}
      suggestedPlaylists={suggestedPlaylists}
      playlists={playlists ?? []}
      abTests={abTests ?? []}
    />
  )
}
