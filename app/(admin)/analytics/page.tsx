import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AnalyticsClient from './AnalyticsClient'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - day)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: dau },
    { count: wau },
    { count: mau },
    { count: newSignups },
    { count: totalUsers },
    { data: habitUsers },
    { data: goalUsers },
    { data: gardenerUsers },
    { data: nutritionUsers },
    { data: allProfiles },
    { data: cohortRaw },
    chatSessionsResult,
    chatMessagesResult,
    pageViewsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_sign_in_at', todayStart),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_sign_in_at', sevenDaysAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_sign_in_at', thirtyDaysAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('habits').select('user_id'),
    supabase.from('goals').select('user_id'),
    supabase.from('gardener_summaries').select('user_id'),
    supabase.from('meal_suggestions').select('user_id'),
    supabase.from('profiles').select('stage'),
    supabase.from('profiles').select('id, created_at, last_sign_in_at').gte('created_at', eightWeeksAgo),
    Promise.resolve(admin.from('gardener_chat_sessions').select('id, created_at').gte('created_at', thirtyDaysAgo).order('created_at')).catch(() => ({ data: null })),
    Promise.resolve(admin.from('gardener_chat_messages').select('session_id, created_at, role, content, response_ms').gte('created_at', thirtyDaysAgo).order('created_at')).catch(() => ({ data: null })),
    Promise.resolve(admin.from('page_views').select('page_name, viewed_at').gte('viewed_at', thirtyDaysAgo)).catch(() => ({ data: null })),
  ])

  const total = Math.max(totalUsers ?? 1, 1)

  // ── Cohort ────────────────────────────────────────────────────────────────
  const cohortProfiles = (cohortRaw ?? []) as Array<{ id: string; created_at: string; last_sign_in_at: string | null }>
  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const cohortMap = new Map<string, { signups: number; active: number }>()
  for (const p of cohortProfiles) {
    const week = getWeekStart(new Date(p.created_at))
    const entry = cohortMap.get(week) ?? { signups: 0, active: 0 }
    entry.signups++
    if (p.last_sign_in_at && new Date(p.last_sign_in_at) >= thirtyDaysAgoDate) entry.active++
    cohortMap.set(week, entry)
  }
  const cohorts = Array.from({ length: 8 }, (_, i) => {
    const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const week = getWeekStart(weekDate)
    const data = cohortMap.get(week) ?? { signups: 0, active: 0 }
    return { week, ...data }
  })

  // ── Feature adoption ──────────────────────────────────────────────────────
  const habitCount = new Set((habitUsers ?? []).map((r) => r.user_id)).size
  const goalCount = new Set((goalUsers ?? []).map((r) => r.user_id)).size
  const gardenerCount = new Set((gardenerUsers ?? []).map((r) => r.user_id)).size
  const nutritionCount = new Set((nutritionUsers ?? []).map((r) => r.user_id)).size

  const features = [
    { label: 'Habits', count: habitCount, color: '#3fb950' },
    { label: 'Goals', count: goalCount, color: '#58a6ff' },
    { label: 'Growth Bible', count: gardenerCount, color: '#bc8cff' },
    { label: 'Nutrition', count: nutritionCount, color: '#39d0d8' },
  ]

  const stageMap: Record<string, number> = {}
  ;(allProfiles ?? []).forEach((p) => {
    const s = p.stage ?? 'Unknown'
    stageMap[s] = (stageMap[s] ?? 0) + 1
  })
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1]) as [string, number][]

  // ── Gardener Chat analytics ───────────────────────────────────────────────
  type Session = { id: string; created_at: string }
  type Message = { session_id: string; created_at: string; role: string; content: string; response_ms: number | null }

  const sessions = ((chatSessionsResult as { data: Session[] | null }).data ?? [])
  const messages = ((chatMessagesResult as { data: Message[] | null }).data ?? [])

  // Day-by-day aggregation
  const dayMap = new Map<string, { messages: number; sessions: Set<string> }>()
  for (const m of messages) {
    const d = m.created_at.slice(0, 10)
    if (!dayMap.has(d)) dayMap.set(d, { messages: 0, sessions: new Set() })
    dayMap.get(d)!.messages++
    dayMap.get(d)!.sessions.add(m.session_id)
  }
  const chatDays = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, messages: v.messages, sessions: v.sessions.size }))

  const totalChatSessions = sessions.length
  const totalChatMessages = messages.filter((m) => m.role === 'user').length
  const assistantMessages = messages.filter((m) => m.role === 'assistant')

  // Avg messages per session
  const msgPerSession = new Map<string, number>()
  for (const m of messages.filter((m) => m.role === 'user')) {
    msgPerSession.set(m.session_id, (msgPerSession.get(m.session_id) ?? 0) + 1)
  }
  const allMsgCounts = Array.from(msgPerSession.values())
  const avgMessagesPerSession = allMsgCounts.length > 0
    ? allMsgCounts.reduce((a, b) => a + b, 0) / allMsgCounts.length
    : 0

  // Drop-off: sessions with only 1 user message
  const singleMsgSessions = allMsgCounts.filter((c) => c <= 1).length
  const chatDropOffPct = totalChatSessions > 0 ? Math.round((singleMsgSessions / totalChatSessions) * 100) : 0

  // Avg response time
  const responseTimes = assistantMessages.map((m) => m.response_ms ?? 0).filter((v) => v > 0)
  const avgResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0

  // Top first messages — first user message per session
  const firstMsgMap = new Map<string, string>()
  const sortedMsgs = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const m of sortedMsgs) {
    if (m.role === 'user' && !firstMsgMap.has(m.session_id)) {
      firstMsgMap.set(m.session_id, m.content)
    }
  }
  const firstMsgCounts = new Map<string, number>()
  for (const content of firstMsgMap.values()) {
    const truncated = content.slice(0, 60)
    firstMsgCounts.set(truncated, (firstMsgCounts.get(truncated) ?? 0) + 1)
  }
  const topFirstMessages = Array.from(firstMsgCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([content, count]) => ({ content, count }))

  // ── Insights page analytics ───────────────────────────────────────────────
  const pageViews = ((pageViewsResult as { data: { page_name: string; viewed_at: string }[] | null }).data ?? [])
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const insightViews30d = pageViews.filter((p) => p.page_name === 'gardener_insights').length
  const insightViewsYesterday = pageViews.filter((p) => p.page_name === 'gardener_insights' && p.viewed_at >= yesterday).length

  // Pattern tap rate: sessions that started from insights page / total insight views
  const insightChatSessions = pageViews.filter((p) => p.page_name === 'gardener_chat').length
  const patternTapRate = insightViews30d > 0 ? Math.round((insightChatSessions / insightViews30d) * 100) : 0
  const chatOpenRate = insightViews30d > 0 ? Math.round((totalChatSessions / Math.max(insightViews30d, 1)) * 100) : 0

  return (
    <AnalyticsClient
      dau={dau ?? 0}
      wau={wau ?? 0}
      mau={mau ?? 0}
      newSignups={newSignups ?? 0}
      total={total}
      features={features}
      stageEntries={stageEntries}
      cohorts={cohorts}
      chatDays={chatDays}
      avgMessagesPerSession={avgMessagesPerSession}
      totalChatSessions={totalChatSessions}
      totalChatMessages={totalChatMessages}
      chatDropOffPct={chatDropOffPct}
      topFirstMessages={topFirstMessages}
      avgResponseMs={avgResponseMs}
      insightViews30d={insightViews30d}
      insightViewsYesterday={insightViewsYesterday}
      patternTapRate={patternTapRate}
      chatOpenRate={chatOpenRate}
    />
  )
}
