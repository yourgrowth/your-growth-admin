import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/ui/PageHeader'
import JournalClient, {
  type FlaggedEntry,
  type JournalStats,
  type MoodGroup,
} from './JournalClient'

const MOOD_GROUPS: Omit<MoodGroup, 'count'>[] = [
  { label: '1–2', emoji: '😩', desc: 'Stressed', color: '#f85149' },
  { label: '3–4', emoji: '😔', desc: 'Low', color: '#d29922' },
  { label: '5–6', emoji: '😐', desc: 'Neutral', color: '#7d8fa3' },
  { label: '7–8', emoji: '😊', desc: 'Good', color: '#3fb950' },
  { label: '9–10', emoji: '😄', desc: 'Great', color: '#39d0d8' },
]

const MOOD_RANGES: [number, number][] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]

function TableMissingNotice() {
  return (
    <div>
      <PageHeader title="Journal" subtitle="User journaling activity and flagged entries" />
      <div
        className="rounded-lg px-4 py-3 mb-8 text-sm"
        style={{ background: '#d2992215', border: '1px solid #d2992240', color: '#d29922' }}
      >
        <span className="font-semibold">Privacy Notice — </span>
        Individual journal entries are private by default. Entry content is only surfaced here
        when an entry has been flagged for review.
      </div>
      <div
        className="rounded-lg p-6"
        style={{ background: '#0d1117', border: '1px solid #f8514940' }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: '#f85149' }}>
          Table not found: <span className="font-mono">journal_entries</span>
        </p>
        <p className="text-sm mb-4" style={{ color: '#7d8fa3' }}>
          Create this table in Supabase with the following columns to enable the journal page:
        </p>
        <pre
          className="text-xs rounded p-4 overflow-x-auto"
          style={{ background: '#080b0f', color: '#3fb950', border: '1px solid #1a2332' }}
        >{`create table journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  content     text,
  mood_score  smallint check (mood_score between 1 and 10),
  flagged     boolean default false,
  created_at  timestamptz default now()
);`}</pre>
      </div>
    </div>
  )
}

export default async function JournalPage() {
  const supabase = await createClient()

  // Fetch aggregate columns only — no content for privacy
  const { data: allEntries, error } = await supabase
    .from('journal_entries')
    .select('mood_score, user_id, created_at, flagged')

  if (error) {
    return <TableMissingNotice />
  }

  const today = new Date().toISOString().slice(0, 10)
  const totalToday = (allEntries ?? []).filter((e) => e.created_at.startsWith(today)).length
  const distinctJournalers = new Set((allEntries ?? []).map((e) => e.user_id)).size
  const flaggedCount = (allEntries ?? []).filter((e) => e.flagged).length

  const moodValues = (allEntries ?? [])
    .map((e) => e.mood_score)
    .filter((s): s is number => s != null)
  const avgMoodScore =
    moodValues.length > 0
      ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length
      : null

  const moodGroups: MoodGroup[] = MOOD_GROUPS.map((g, i) => ({
    ...g,
    count: (allEntries ?? []).filter((e) => {
      const [lo, hi] = MOOD_RANGES[i]
      return e.mood_score != null && e.mood_score >= lo && e.mood_score <= hi
    }).length,
  }))

  const { count: totalProfiles } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const stats: JournalStats = {
    totalToday,
    activeJournalersCount: distinctJournalers,
    totalProfiles: totalProfiles ?? 0,
    avgMoodScore,
    flaggedCount,
  }

  // Fetch flagged entries — content is permitted here
  const { data: flagged } = await supabase
    .from('journal_entries')
    .select('id, user_id, created_at, mood_score, content')
    .eq('flagged', true)
    .order('created_at', { ascending: false })

  const flaggedUserIds = [...new Set((flagged ?? []).map((e) => e.user_id))]
  const { data: profiles } =
    flaggedUserIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', flaggedUserIds)
      : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const flaggedEntries: FlaggedEntry[] = (flagged ?? []).map((e) => ({
    id: e.id,
    user_name: profileMap.get(e.user_id) ?? null,
    created_at: e.created_at,
    mood_score: e.mood_score,
    content_preview: e.content ? e.content.slice(0, 100) : null,
  }))

  return <JournalClient stats={stats} moodGroups={moodGroups} flaggedEntries={flaggedEntries} />
}
