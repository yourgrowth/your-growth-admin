'use client'

import { useState, useTransition, useEffect } from 'react'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Btn from '@/components/ui/Btn'
import {
  suspendUser, restoreUser, grantPro, revokePro, deleteUser,
  issueWarning, resolveWarning, getUserWarnings,
  getUserHabits, getUserGoals, getUserGardener, getUserTimeline,
  sendUserEmail, sendUserPush, getUserCommunications, getUserNotificationHistory,
  resetPassword, generateImpersonationLink, adjustPoints, getPointsHistory,
  resetStreak, setStage, setAppealStatus as saveAppealStatus,
  deleteHabit, addGoalNote, getGoalNotes, setGardenerPhase as setGardenerPhaseAction,
  clearUserData, anonymiseAccount, saveAdminNote, getAdminNotes,
  getHabitCompletionGrid, getUserHabitsExtended, getUserNutritionData,
  getUserJournalData, unflagJournalEntry, deleteJournalEntry,
  deleteGoal, getUserModerationHistory, getUserActivityFeed, getGardenerProfile,
  getGardenerContext, getUserModel,
  type TimelineEvent,
  type HabitExtended, type NutritionData, type JournalData,
} from '@/app/actions/users'
import type {
  Profile, Habit, Goal, GardenerSummary,
  NotificationLog, UserCommunication, UserWarning, PointsHistoryEntry,
  GoalNote, AdminNote,
} from '@/types/database'

const STAGES = ['Seed','Sprout','Seedling','Sapling','Young Tree','Mature Tree','Ancient Tree','Legendary']
const GARDENER_PHASES = ['Phase 1','Phase 2','Phase 3','Phase 4','Phase 5','Phase 6','Phase 7','Phase 8']

export type UserWithEmail = Profile & { email: string; last_sign_in_at: string | null; riskScore: number }

type Props = { user: UserWithEmail; onClose: () => void }

const TABS = ['Overview','Activity','Habits','Nutrition','Goals','Journal','Gardener','Communications','Moderation','Timeline','Settings'] as const
type Tab = typeof TABS[number]

const inp: React.CSSProperties = {
  background: '#080b0f', border: '1px solid #1a2332', color: '#e6edf3',
  borderRadius: 4, padding: '6px 10px', fontSize: 13,
  fontFamily: 'IBM Plex Mono, monospace', width: '100%', outline: 'none',
}
const sh: React.CSSProperties = {
  color: '#7d8fa3', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
}

function severityColor(s: string) {
  if (s === 'High') return '#f85149'
  if (s === 'Medium') return '#d29922'
  return '#58a6ff'
}

function ContribGrid({ grid }: { grid: { date: string; count: number }[] }) {
  const today = new Date()
  const days: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const entry = grid.find(g => g.date === key)
    days.push({ date: key, count: entry?.count ?? 0 })
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {days.map(d => (
        <div
          key={d.date}
          title={`${d.date}: ${d.count} completions`}
          style={{
            width: 12, height: 12, borderRadius: 2,
            background: d.count === 0 ? '#1a2332' : d.count < 3 ? '#3fb95066' : '#3fb950',
          }}
        />
      ))}
    </div>
  )
}

function MoodBar({ entries }: { entries: JournalData['entries'] }) {
  const today = new Date()
  const days: { date: string; score: number | null }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const entry = entries.find(e => e.created_at.slice(0, 10) === key)
    days.push({ date: key, score: entry?.mood_score ?? null })
  }
  const maxH = 40
  return (
    <div className="flex items-end gap-0.5" style={{ height: maxH + 4 }}>
      {days.map(d => (
        <div
          key={d.date}
          title={`${d.date}: ${d.score ?? 'no data'}`}
          style={{
            width: 8,
            height: d.score != null ? Math.max(2, (d.score / 10) * maxH) : 2,
            background: d.score != null ? '#58a6ff' : '#1a2332',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  )
}

export default function UserDrawer({ user, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [isPending, startTransition] = useTransition()

  // Eagerly loaded
  const [warnings, setWarnings] = useState<UserWarning[] | null>(null)
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryEntry[] | null>(null)

  // Tab data (lazy)
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [habitsExt, setHabitsExt] = useState<HabitExtended[] | null>(null)
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [goalNotes, setGoalNotes] = useState<Record<string, GoalNote[]>>({})
  const [gardener, setGardener] = useState<GardenerSummary[] | null>(null)
  const [gardenerProfile, setGardenerProfile] = useState<{ phase?: string | null } | null>(null)
  const [gardenerContext, setGardenerContext] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [userModel, setUserModel] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null)
  const [communications, setCommunications] = useState<UserCommunication[] | null>(null)
  const [notifHistory, setNotifHistory] = useState<NotificationLog[] | null>(null)
  const [adminNotes, setAdminNotes] = useState<(AdminNote & { admin_name: string | null })[] | null>(null)
  const [contribGrid, setContribGrid] = useState<{ date: string; count: number }[] | null>(null)
  const [activity, setActivity] = useState<{ date: string; icon: string; label: string; type: string }[] | null>(null)
  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [journal, setJournal] = useState<JournalData | null>(null)
  const [modHistory, setModHistory] = useState<{ id: string; action: string; created_at: string }[] | null>(null)

  // Forms
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [pushMessage, setPushMessage] = useState('')
  const [pointAmount, setPointAmount] = useState('')
  const [pointReason, setPointReason] = useState('')
  const [selectedStage, setSelectedStage] = useState(user.stage ?? STAGES[0])
  const [appealStatus, setAppealStatus] = useState(user.appeal_status ?? 'none')
  const [warningModal, setWarningModal] = useState(false)
  const [warningReason, setWarningReason] = useState('')
  const [warningSeverity, setWarningSeverity] = useState<'Low'|'Medium'|'High'>('Low')
  const [impersonateModal, setImpersonateModal] = useState(false)
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null)
  const [impersonateLoading, setImpersonateLoading] = useState(false)
  const [streakModal, setStreakModal] = useState(false)
  const [streakReason, setStreakReason] = useState('')
  const [adminNoteText, setAdminNoteText] = useState('')
  const [newGoalNote, setNewGoalNote] = useState<Record<string, string>>({})
  const [gardenerPhase, setGardenerPhase] = useState('')

  useEffect(() => {
    getUserWarnings(user.id).then(setWarnings)
    getPointsHistory(user.id).then(setPointsHistory)
    getHabitCompletionGrid(user.id).then(setContribGrid)
    getUserHabits(user.id).then(setHabits)
    getUserGoals(user.id).then(setGoals)
  }, [user.id])

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    if (tab === 'Activity' && activity === null)
      startTransition(async () => setActivity(await getUserActivityFeed(user.id)))
    if (tab === 'Habits' && habitsExt === null)
      startTransition(async () => setHabitsExt(await getUserHabitsExtended(user.id)))
    if (tab === 'Nutrition' && nutrition === null)
      startTransition(async () => setNutrition(await getUserNutritionData(user.id)))
    if (tab === 'Goals' && goals === null)
      startTransition(async () => setGoals(await getUserGoals(user.id)))
    if (tab === 'Journal' && journal === null)
      startTransition(async () => setJournal(await getUserJournalData(user.id)))
    if (tab === 'Gardener' && gardener === null)
      startTransition(async () => {
        const [g, gp, gc, um] = await Promise.all([
          getUserGardener(user.id),
          getGardenerProfile(user.id),
          getGardenerContext(user.id),
          getUserModel(user.id),
        ])
        setGardener(g)
        setGardenerProfile(gp)
        setGardenerContext(gc)
        setUserModel(um)
        if (gp?.phase) setGardenerPhase(gp.phase ?? '')
      })
    if (tab === 'Timeline' && timeline === null)
      startTransition(async () => setTimeline(await getUserTimeline(user.id)))
    if (tab === 'Communications' && communications === null)
      startTransition(async () => {
        const [comms, notifs, notes] = await Promise.all([
          getUserCommunications(user.id),
          getUserNotificationHistory(user.id),
          getAdminNotes(user.id),
        ])
        setCommunications(comms)
        setNotifHistory(notifs)
        setAdminNotes(notes)
      })
    if (tab === 'Moderation' && modHistory === null)
      startTransition(async () => {
        const h = await getUserModerationHistory(user.id)
        setModHistory(h as { id: string; action: string; created_at: string }[])
      })
    if (tab === 'Settings') { /* uses user prop */ }
  }

  const isSuspended = user.status === 'suspended'
  const isPro = user.plan === 'pro'
  const riskColor = user.riskScore <= 2 ? '#3fb950' : user.riskScore <= 5 ? '#d29922' : '#f85149'
  const riskLabel = user.riskScore <= 2 ? 'Low' : user.riskScore <= 5 ? 'Medium' : 'High'
  const unresolvedWarnings = warnings?.filter(w => !w.resolved) ?? []
  const showEscalationBanner = warnings !== null && unresolvedWarnings.length >= 3

  const totalCompletions = contribGrid?.reduce((s, g) => s + g.count, 0) ?? 0
  const engagementScore = Math.round((user.streak ?? 0) * 2 + (user.points ?? 0) / 100 + totalCompletions * 0.5)

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
        style={{ width: 900, background: '#0d1117', borderLeft: '1px solid #1a2332', fontFamily: 'IBM Plex Mono, monospace' }}
      >
        {showEscalationBanner && (
          <div className="px-6 py-2.5 shrink-0" style={{ background: '#f8514918', borderBottom: '1px solid #f8514966' }}>
            <p className="text-xs font-medium" style={{ color: '#f85149' }}>
              âš  {unresolvedWarnings.length} unresolved warnings â€” consider escalation to permanent ban
            </p>
          </div>
        )}

        {/* Persistent header */}
        <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1a2332' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold shrink-0"
                style={{ background: '#1a2332', color: '#3fb950' }}>
                {(user.full_name ?? user.email)[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold" style={{ color: '#e6edf3' }}>{user.full_name ?? 'â€”'}</p>
                <p className="text-xs" style={{ color: '#7d8fa3' }}>{user.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge color={isPro ? '#bc8cff' : '#7d8fa3'}>{user.plan ?? 'free'}</Badge>
                  <Badge color={isSuspended ? '#f85149' : '#3fb950'}>{user.status ?? 'active'}</Badge>
                  <Badge color={riskColor}>{riskLabel} Risk Â· {user.riskScore}</Badge>
                  {(warnings?.filter(w => !w.resolved).length ?? 0) > 0 && (
                    <Badge color="#f85149">{warnings!.filter(w => !w.resolved).length} warnings</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-right shrink-0" style={{ color: '#7d8fa3' }}>
              <p>Joined {new Date(user.created_at).toLocaleDateString()}</p>
              {user.last_sign_in_at && <p>Last active {new Date(user.last_sign_in_at).toLocaleDateString()}</p>}
            </div>
            <button onClick={onClose} className="text-lg leading-none shrink-0 ml-2" style={{ color: '#7d8fa3' }}>âœ•</button>
          </div>

          {/* Mini stats row */}
          <div className="flex items-center gap-4 mt-3 pt-3 overflow-x-auto" style={{ borderTop: '1px solid #1a2332' }}>
            {[
              { label: 'Streak', value: `${user.streak ?? 0}d`, color: '#3fb950' },
              { label: 'Points', value: user.points ?? 0, color: '#58a6ff' },
              { label: 'Stage', value: user.stage ?? 'â€”', color: '#bc8cff' },
              { label: 'Habits', value: habits?.length ?? 'â€¦', color: '#e6edf3' },
              { label: 'Goals', value: goals?.length ?? 'â€¦', color: '#e6edf3' },
              { label: 'Completions', value: totalCompletions, color: '#3fb950' },
              { label: 'Engagement', value: engagementScore, color: '#d29922' },
            ].map(s => (
              <div key={s.label} className="text-center shrink-0">
                <p className="text-xs" style={{ color: '#7d8fa3' }}>{s.label}</p>
                <p className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-4 shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #1a2332' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => switchTab(tab)}
              className="py-3 text-xs font-medium transition-colors whitespace-nowrap"
              style={{ color: activeTab === tab ? '#3fb950' : '#7d8fa3', borderBottom: activeTab === tab ? '2px solid #3fb950' : '2px solid transparent' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* â”€â”€ OVERVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Overview' && (
            <div className="flex flex-col gap-6">
              {/* Streak contribution grid */}
              <div>
                <p className="mb-2" style={sh}>30-Day Completion History</p>
                <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <ContribGrid grid={contribGrid ?? []} />
                  <p className="text-xs mt-2" style={{ color: '#7d8fa3' }}>
                    {totalCompletions} completions in last 30 days
                  </p>
                </div>
              </div>

              {/* Engagement score */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded col-span-1" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Engagement Score</p>
                  <p className="text-3xl font-bold" style={{ color: '#d29922' }}>{engagementScore}</p>
                  <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>streakÃ—2 + pts/100 + completionsÃ—0.5</p>
                </div>
                <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <p className="text-xs mb-2" style={{ color: '#7d8fa3' }}>Points Breakdown</p>
                  {pointsHistory && pointsHistory.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {pointsHistory.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-28" style={{ color: '#7d8fa3' }}>{p.reason ?? 'â€”'}</span>
                          <span style={{ color: p.amount >= 0 ? '#3fb950' : '#f85149' }}>{p.amount >= 0 ? '+' : ''}{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>No history.</p>
                  )}
                </div>
                <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <p className="text-xs mb-2" style={{ color: '#7d8fa3' }}>Actions</p>
                  <div className="flex flex-col gap-2">
                    <Btn variant={isSuspended ? 'ghost' : 'danger'} onClick={() => startTransition(async () => {
                      await (isSuspended ? restoreUser(user.id) : suspendUser(user.id))
                    })} disabled={isPending}>{isSuspended ? 'Restore' : 'Suspend'}</Btn>
                    <Btn variant="ghost" onClick={() => startTransition(async () => {
                      await (isPro ? revokePro(user.id) : grantPro(user.id))
                    })} disabled={isPending}>{isPro ? 'Revoke Pro' : 'Grant Pro'}</Btn>
                    <Btn variant="ghost" onClick={() => setWarningModal(true)} disabled={isPending}>Issue Warning</Btn>
                  </div>
                </div>
              </div>

              {/* Points adjustment */}
              <div className="p-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p style={sh}>Adjust Points</p>
                <div className="flex gap-2">
                  <input type="number" placeholder="Â±amount" value={pointAmount} onChange={e => setPointAmount(e.target.value)} style={{ ...inp, width: 100 }} />
                  <input type="text" placeholder="Reason" value={pointReason} onChange={e => setPointReason(e.target.value)} style={inp} />
                  <button onClick={() => {
                    const amount = parseInt(pointAmount)
                    if (!amount || !pointReason.trim()) return
                    startTransition(async () => {
                      await adjustPoints(user.id, amount, pointReason.trim())
                      setPointsHistory(await getPointsHistory(user.id))
                      setPointAmount(''); setPointReason('')
                    })
                  }} disabled={isPending || !pointAmount || !pointReason.trim()}
                    className="px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap disabled:opacity-50"
                    style={{ background: '#1a2332', color: '#e6edf3', border: '1px solid #1a2332' }}>
                    Apply
                  </button>
                </div>
              </div>

              {/* Stage + streak */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded flex items-center justify-between gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-2" style={{ color: '#e6edf3' }}>Stage</p>
                    <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} style={{ ...inp, width: '100%' }}>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button onClick={() => startTransition(async () => { await setStage(user.id, selectedStage) })}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded text-xs font-medium mt-5 whitespace-nowrap disabled:opacity-50"
                    style={{ background: '#1a2332', color: '#bc8cff', border: '1px solid #bc8cff44' }}>
                    Apply
                  </button>
                </div>
                <div className="p-4 rounded flex items-center justify-between" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#e6edf3' }}>Streak</p>
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>Current: {user.streak ?? 0} days</p>
                  </div>
                  <button onClick={() => setStreakModal(true)}
                    className="px-3 py-1.5 rounded text-xs font-medium"
                    style={{ background: 'transparent', border: '1px solid #f85149', color: '#f85149' }}>
                    Reset Streak
                  </button>
                </div>
              </div>

              {/* Appeal */}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#7d8fa3' }}>Appeal:</span>
                <select value={appealStatus} onChange={e => setAppealStatus(e.target.value)}
                  style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#e6edf3', borderRadius: 4, padding: '3px 8px', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', outline: 'none' }}>
                  <option value="none">None</option>
                  <option value="appealing">Under Appeal</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button onClick={() => startTransition(async () => { await saveAppealStatus(user.id, appealStatus) })}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded disabled:opacity-50"
                  style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}>
                  Set
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ ACTIVITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Activity' && (
            <div>
              {activity === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : activity.length === 0 ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>No activity recorded.</p>
              ) : (
                <ol className="flex flex-col gap-0">
                  {activity.map((event, i) => (
                    <li key={i} className="flex gap-4 pb-5 last:pb-0">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs shrink-0"
                          style={{ background: '#1a2332', border: '1px solid #3fb950', color: '#3fb950' }}>
                          {event.icon}
                        </div>
                        {i < activity.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: '#1a2332', minHeight: 12 }} />}
                      </div>
                      <div className="pt-1 pb-2 min-w-0">
                        <p className="text-sm" style={{ color: '#e6edf3' }}>{event.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>{new Date(event.date).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* â”€â”€ HABITS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Habits' && (
            <div>
              {habitsExt === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : habitsExt.length === 0 ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>No habits.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {habitsExt.map(h => (
                    <li key={h.id} className="px-4 py-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{h.name}</p>
                          {h.category && <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>{h.category}</p>}
                        </div>
                        <button onClick={() => {
                          if (confirm('Delete this habit?')) {
                            startTransition(async () => {
                              await deleteHabit(h.id)
                              setHabitsExt(prev => prev?.filter(x => x.id !== h.id) ?? null)
                            })
                          }
                        }} disabled={isPending}
                          className="text-xs px-2 py-1 rounded disabled:opacity-50"
                          style={{ background: 'transparent', border: '1px solid #f85149', color: '#f85149' }}>
                          Delete
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div><span style={{ color: '#7d8fa3' }}>Completions: </span><span style={{ color: '#e6edf3' }}>{h.totalCompletions}</span></div>
                        <div><span style={{ color: '#7d8fa3' }}>Last completed: </span><span style={{ color: '#e6edf3' }}>{h.lastCompleted ? new Date(h.lastCompleted).toLocaleDateString() : 'â€”'}</span></div>
                        <div><span style={{ color: '#7d8fa3' }}>Created: </span><span style={{ color: '#e6edf3' }}>{new Date(h.created_at).toLocaleDateString()}</span></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: '#7d8fa3' }}>30-day completion rate</span>
                          <span style={{ color: '#3fb950' }}>{h.completionRate30}%</span>
                        </div>
                        <ProgressBar value={h.completionRate30} color="#3fb950" />
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>30-day calendar</p>
                        <ContribGrid grid={(() => {
                          const today = new Date()
                          return Array.from({ length: 30 }, (_, i) => {
                            const d = new Date(today); d.setDate(d.getDate() - (29 - i))
                            const date = d.toISOString().slice(0, 10)
                            return { date, count: h.completionDates.includes(date) ? 1 : 0 }
                          })
                        })()} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* â”€â”€ NUTRITION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Nutrition' && (
            <div className="flex flex-col gap-6">
              {nutrition === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Avg Calories/Day" value={nutrition.macros.calories} sub="7-day avg" color="#d29922" />
                    <StatCard label="Avg Protein/Day" value={`${nutrition.macros.protein}g`} color="#3fb950" />
                    <StatCard label="Avg Carbs/Day" value={`${nutrition.macros.carbs}g`} color="#58a6ff" />
                    <StatCard label="Avg Fat/Day" value={`${nutrition.macros.fat}g`} color="#bc8cff" />
                  </div>

                  <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                    <p className="text-xs mb-2" style={{ color: '#7d8fa3' }}>Water Goal Hit Rate (30 days)</p>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={nutrition.waterHitRate} color="#39d0d8" />
                      <span className="text-sm font-medium shrink-0" style={{ color: '#39d0d8' }}>{nutrition.waterHitRate}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                      <p className="text-xs mb-3" style={sh}>Top Logged Foods</p>
                      {nutrition.topFoods.length === 0 ? (
                        <p className="text-xs" style={{ color: '#7d8fa3' }}>No data.</p>
                      ) : (
                        <ol className="flex flex-col gap-1">
                          {nutrition.topFoods.map((f, i) => (
                            <li key={f.name} className="flex items-center justify-between text-xs">
                              <span style={{ color: '#e6edf3' }}>{i + 1}. {f.name}</span>
                              <span style={{ color: '#7d8fa3' }}>{f.count}Ã—</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                      <p className="text-xs mb-3" style={sh}>Body Logs</p>
                      {nutrition.bodyLogs.length === 0 ? (
                        <p className="text-xs" style={{ color: '#7d8fa3' }}>No body logs.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <tbody>
                            {nutrition.bodyLogs.slice(0, 8).map((b, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                                <td className="py-1.5 pr-3" style={{ color: '#7d8fa3' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                                <td className="py-1.5" style={{ color: '#e6edf3' }}>{b.weight != null ? `${b.weight}${b.weight_unit ?? 'kg'}` : 'â€”'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                    <p className="text-xs mb-3" style={sh}>Meal Suggestion History</p>
                    {nutrition.mealSuggestions.length === 0 ? (
                      <p className="text-xs" style={{ color: '#7d8fa3' }}>No meal suggestions.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {nutrition.mealSuggestions.map(m => (
                          <li key={m.id} className="text-xs flex items-start justify-between gap-2">
                            <p className="truncate flex-1" style={{ color: '#e6edf3' }}>{m.meal_name ?? 'â€”'}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.flagged && <Badge color="#f85149">Flagged</Badge>}
                              <span style={{ color: '#7d8fa3' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* â”€â”€ GOALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Goals' && (
            <div>
              {goals === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : goals.length === 0 ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>No goals.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {goals.map(g => (
                    <li key={g.id} className="px-4 py-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{g.title}</p>
                          <div className="flex gap-2 mt-1">
                            {g.category && <Badge color="#7d8fa3">{g.category}</Badge>}
                            {g.status && <Badge color={g.status === 'completed' ? '#3fb950' : g.status === 'in_progress' ? '#58a6ff' : '#7d8fa3'}>{g.status}</Badge>}
                            {g.gardener_linked && <Badge color="#bc8cff">Gardener</Badge>}
                          </div>
                        </div>
                        <button onClick={() => {
                          if (confirm('Delete this goal?')) {
                            startTransition(async () => {
                              await deleteGoal(g.id)
                              setGoals(prev => prev?.filter(x => x.id !== g.id) ?? null)
                            })
                          }
                        }} disabled={isPending}
                          className="text-xs px-2 py-1 rounded disabled:opacity-50"
                          style={{ background: 'transparent', border: '1px solid #f85149', color: '#f85149' }}>
                          Delete
                        </button>
                      </div>
                      <ProgressBar value={g.progress ?? 0} color={g.status === 'completed' ? '#3fb950' : '#58a6ff'} />
                      <div className="text-xs" style={{ color: '#7d8fa3' }}>
                        Created {new Date(g.created_at).toLocaleDateString()}
                      </div>

                      {/* Goal notes */}
                      <div>
                        <p className="text-xs mb-2" style={sh}>Admin Notes</p>
                        {(goalNotes[g.id] ?? []).map(n => (
                          <div key={n.id} className="text-xs px-3 py-2 rounded mb-1" style={{ background: '#1a2332' }}>
                            <p style={{ color: '#e6edf3' }}>{n.note}</p>
                            <p className="mt-0.5" style={{ color: '#7d8fa3' }}>{new Date(n.created_at).toLocaleDateString()}</p>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            placeholder="Add a noteâ€¦"
                            value={newGoalNote[g.id] ?? ''}
                            onChange={e => setNewGoalNote(prev => ({ ...prev, [g.id]: e.target.value }))}
                            style={{ ...inp, fontSize: 12 }}
                          />
                          <button onClick={() => {
                            const note = newGoalNote[g.id]?.trim()
                            if (!note) return
                            startTransition(async () => {
                              await addGoalNote(g.id, note)
                              const notes = await getGoalNotes(g.id)
                              setGoalNotes(prev => ({ ...prev, [g.id]: notes }))
                              setNewGoalNote(prev => ({ ...prev, [g.id]: '' }))
                            })
                          }} disabled={isPending || !newGoalNote[g.id]?.trim()}
                            className="px-3 py-1.5 rounded text-xs whitespace-nowrap disabled:opacity-50"
                            style={{ background: '#1a2332', color: '#e6edf3', border: '1px solid #1a2332' }}>
                            Add
                          </button>
                        </div>
                        {!goalNotes[g.id] && (
                          <button onClick={() => startTransition(async () => {
                            const notes = await getGoalNotes(g.id)
                            setGoalNotes(prev => ({ ...prev, [g.id]: notes }))
                          })} className="text-xs mt-1" style={{ color: '#58a6ff' }}>
                            Load notes
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* â”€â”€ JOURNAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Journal' && (
            <div className="flex flex-col gap-6">
              {journal === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : (
                <>
                  <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                    <p className="text-xs mb-3" style={sh}>30-Day Mood</p>
                    <MoodBar entries={journal.entries} />
                    <div className="flex gap-6 mt-3 text-xs">
                      <div><span style={{ color: '#7d8fa3' }}>Avg mood: </span><span style={{ color: '#58a6ff' }}>{journal.avgMood}/10</span></div>
                      <div><span style={{ color: '#7d8fa3' }}>Entries: </span><span style={{ color: '#e6edf3' }}>{journal.entries.length}</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                    <p className="text-xs mb-3" style={sh}>Entries per Week</p>
                    <table className="w-full text-xs">
                      <tbody>
                        {journal.weekCounts.map(w => (
                          <tr key={w.week} style={{ borderBottom: '1px solid #1a2332' }}>
                            <td className="py-1.5 pr-3" style={{ color: '#7d8fa3' }}>Week of {new Date(w.week).toLocaleDateString()}</td>
                            <td className="py-1.5 font-medium" style={{ color: '#e6edf3' }}>{w.count} entries</td>
                          </tr>
                        ))}
                        {journal.weekCounts.length === 0 && (
                          <tr><td colSpan={2} className="py-4 text-center" style={{ color: '#7d8fa3' }}>No data.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Flagged entries */}
                  {journal.entries.filter(e => e.flagged).length > 0 && (
                    <div>
                      <p className="mb-3" style={sh}>Flagged Entries</p>
                      <ul className="flex flex-col gap-3">
                        {journal.entries.filter(e => e.flagged).map(e => (
                          <li key={e.id} className="px-4 py-3 rounded" style={{ background: '#080b0f', border: '1px solid #f8514933' }}>
                            <p className="text-sm mb-2" style={{ color: '#e6edf3' }}>{e.content ?? '(no content)'}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs" style={{ color: '#7d8fa3' }}>
                                Mood: {e.mood_score ?? 'â€”'}/10 Â· {new Date(e.created_at).toLocaleString()}
                              </p>
                              <div className="flex gap-2">
                                <button onClick={() => startTransition(async () => {
                                  await unflagJournalEntry(e.id)
                                  setJournal(prev => prev ? { ...prev, entries: prev.entries.map(x => x.id === e.id ? { ...x, flagged: false } : x) } : null)
                                })} disabled={isPending}
                                  className="text-xs px-2 py-1 rounded disabled:opacity-50"
                                  style={{ background: 'transparent', border: '1px solid #3fb950', color: '#3fb950' }}>
                                  Unflag
                                </button>
                                <button onClick={() => {
                                  if (confirm('Delete this entry?')) {
                                    startTransition(async () => {
                                      await deleteJournalEntry(e.id)
                                      setJournal(prev => prev ? { ...prev, entries: prev.entries.filter(x => x.id !== e.id) } : null)
                                    })
                                  }
                                }} disabled={isPending}
                                  className="text-xs px-2 py-1 rounded disabled:opacity-50"
                                  style={{ background: 'transparent', border: '1px solid #f85149', color: '#f85149' }}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* â”€â”€ GARDENER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Gardener' && (
            <div className="flex flex-col gap-6">
              {/* Phase progression */}
              <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p className="text-xs mb-3" style={sh}>Phase Progression</p>
                <div className="flex gap-1 mb-3">
                  {GARDENER_PHASES.map((phase, i) => {
                    const currentIdx = GARDENER_PHASES.indexOf(gardenerProfile?.phase ?? '')
                    return (
                      <div key={phase} className="flex-1 rounded" style={{
                        height: 8,
                        background: i <= currentIdx ? '#bc8cff' : '#1a2332',
                      }} title={phase} />
                    )
                  })}
                </div>
                <p className="text-xs" style={{ color: '#7d8fa3' }}>Current: {gardenerProfile?.phase ?? 'Unknown'}</p>

                <div className="flex gap-2 mt-3">
                  <select value={gardenerPhase} onChange={e => setGardenerPhase(e.target.value)}
                    style={{ ...inp, width: 160 }}>
                    {GARDENER_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => startTransition(async () => {
                    await setGardenerPhaseAction(user.id, gardenerPhase)
                    setGardenerProfile(prev => ({ ...prev, phase: gardenerPhase }))
                  })} disabled={isPending}
                    className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                    style={{ background: '#bc8cff22', color: '#bc8cff', border: '1px solid #bc8cff44' }}>
                    Set Phase
                  </button>
                </div>
              </div>

              {/* Context Snapshot Summary */}
              {(gardenerContext !== undefined || userModel !== undefined) && (
                <div className="p-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <p className="text-xs mb-1" style={sh}>Context Snapshot</p>
                  {gardenerContext === null && userModel === null ? (
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>No context snapshot built yet â€” run the intelligence pipeline.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {userModel && (
                        <>
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Data Confidence</p>
                            <p className="text-sm font-medium" style={{ color: Number(userModel.data_confidence_score ?? 0) < 30 ? '#f85149' : Number(userModel.data_confidence_score ?? 0) < 60 ? '#d29922' : '#3fb950' }}>
                              {userModel.data_confidence_score != null ? String(userModel.data_confidence_score) : 'â€”'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Active Day Rate</p>
                            <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                              {userModel.active_day_rate != null ? `${Math.round(Number(userModel.active_day_rate) * 100)}%` : 'â€”'}
                              {userModel.total_active_days != null && <span style={{ color: '#7d8fa3' }}> ({String(userModel.total_active_days)}d)</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Re-Engagement</p>
                            <p className="text-sm font-medium" style={{ color: userModel.currently_returning ? '#3fb950' : '#7d8fa3' }}>
                              {userModel.currently_returning ? 'Currently returning' : 'Not in gap'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Voice Register</p>
                            <p className="text-sm font-medium" style={{ color: '#bc8cff' }}>
                              {userModel.voice_register != null ? String(userModel.voice_register) : 'â€”'}
                            </p>
                          </div>
                          {userModel.key_action_today && (
                            <div className="col-span-2">
                              <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Today&apos;s Key Action</p>
                              <p className="text-xs italic" style={{ color: '#e6edf3' }}>{String(userModel.key_action_today)}</p>
                            </div>
                          )}
                        </>
                      )}
                      {gardenerContext && (
                        <div className="col-span-2">
                          <p className="text-xs mb-1" style={{ color: '#7d8fa3' }}>Strongest Correlation</p>
                          {(() => {
                            const ctx = (gardenerContext.context_json as Record<string, unknown>) ?? {}
                            const allTime = (ctx.all_time as Record<string, unknown>) ?? {}
                            const correlations = (allTime.correlations as Array<Record<string, unknown>>) ?? []
                            const top = correlations[0]
                            return top ? (
                              <p className="text-xs" style={{ color: '#58a6ff' }}>
                                {String(top.metric_a ?? '?')} Ã— {String(top.metric_b ?? '?')} â€” r={Number(top.strength ?? 0).toFixed(2)} ({String(top.data_points ?? '?')} data points)
                              </p>
                            ) : <p className="text-xs" style={{ color: '#7d8fa3' }}>No correlations yet</p>
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Summaries */}
              {gardener === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : gardener.length === 0 ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>No summaries.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {gardener.map(entry => (
                    <li key={entry.id} className="px-4 py-3 rounded flex flex-col gap-2" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {entry.phase && <Badge color="#bc8cff">{entry.phase}</Badge>}
                          {entry.prompt_version && <Badge color="#7d8fa3">v{entry.prompt_version}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.flagged && <Badge color="#f85149">Flagged</Badge>}
                          <span className="text-xs" style={{ color: '#7d8fa3' }}>{new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {entry.summary && <p className="text-sm" style={{ color: '#e6edf3' }}>{entry.summary}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* â”€â”€ COMMUNICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Communications' && (
            <div className="flex flex-col gap-6">
              {/* Email */}
              <div className="flex flex-col gap-3">
                <p style={sh}>Email</p>
                <div className="p-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <input type="text" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} style={inp} />
                  <textarea placeholder="Body" value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
                  <button onClick={() => {
                    if (!emailSubject.trim() || !emailBody.trim()) return
                    startTransition(async () => {
                      await sendUserEmail(user.id, emailSubject.trim(), emailBody.trim())
                      setCommunications(await getUserCommunications(user.id))
                      setEmailSubject(''); setEmailBody('')
                    })
                  }} disabled={isPending || !emailSubject.trim() || !emailBody.trim()}
                    className="self-start px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                    style={{ background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44' }}>
                    Send Email
                  </button>
                </div>
              </div>

              {/* Push */}
              <div className="flex flex-col gap-3">
                <p style={sh}>Push Notification</p>
                <div className="p-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                  <input type="text" placeholder="Message" value={pushMessage} onChange={e => setPushMessage(e.target.value)} style={inp} />
                  <button onClick={() => {
                    if (!pushMessage.trim()) return
                    startTransition(async () => {
                      await sendUserPush(user.id, pushMessage.trim())
                      setCommunications(await getUserCommunications(user.id))
                      setPushMessage('')
                    })
                  }} disabled={isPending || !pushMessage.trim()}
                    className="self-start px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                    style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb95044' }}>
                    Send Push
                  </button>
                </div>
              </div>

              {/* SMS placeholder */}
              <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#7d8fa3' }}>SMS</p>
                <p className="text-xs" style={{ color: '#7d8fa3' }}>SMS requires Twilio integration â€” not yet configured.</p>
              </div>

              {/* Admin notes */}
              <div className="flex flex-col gap-3">
                <p style={sh}>Admin Notes</p>
                {adminNotes === null ? (
                  <p className="text-xs" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
                ) : (
                  <>
                    {adminNotes.map(n => (
                      <div key={n.id} className="px-3 py-2 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                        <p className="text-sm" style={{ color: '#e6edf3' }}>{n.note}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                          {n.admin_name ?? 'Admin'} Â· {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    <div className="p-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                      <textarea
                        placeholder="Write an internal admin noteâ€¦"
                        value={adminNoteText}
                        onChange={e => setAdminNoteText(e.target.value)}
                        rows={3}
                        style={{ ...inp, resize: 'vertical' }}
                      />
                      <button onClick={() => {
                        if (!adminNoteText.trim()) return
                        startTransition(async () => {
                          await saveAdminNote(user.id, adminNoteText.trim())
                          setAdminNotes(await getAdminNotes(user.id))
                          setAdminNoteText('')
                        })
                      }} disabled={isPending || !adminNoteText.trim()}
                        className="self-start px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                        style={{ background: '#1a2332', color: '#e6edf3', border: '1px solid #1a2332' }}>
                        Save Note
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Communications history */}
              {communications !== null && (
                <div className="flex flex-col gap-2">
                  <p style={sh}>Sent History</p>
                  {communications.length === 0 ? (
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>Nothing sent yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {communications.map(c => (
                        <li key={c.id} className="px-3 py-2 rounded flex items-center justify-between" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                          <div>
                            <p className="text-xs font-medium" style={{ color: '#e6edf3' }}>{c.subject ?? c.body?.slice(0, 60) ?? 'â€”'}</p>
                            <p className="text-xs" style={{ color: '#7d8fa3' }}>{c.type} Â· {new Date(c.sent_at).toLocaleString()}</p>
                          </div>
                          <Badge color="#7d8fa3">{c.type}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€ MODERATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Moderation' && (
            <div className="flex flex-col gap-6">
              {/* Risk assessment */}
              <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p className="text-xs mb-3" style={sh}>Risk Assessment</p>
                {[
                  { label: 'Streak = 0', present: (user.streak ?? 0) === 0 },
                  { label: 'Multiple warnings (3+)', present: (user.warnings ?? 0) >= 3 },
                  { label: 'Account suspended', present: user.status === 'suspended' },
                  { label: 'Has unresolved warnings', present: unresolvedWarnings.length > 0 },
                ].map(factor => (
                  <div key={factor.label} className="flex items-center gap-2 py-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: factor.present ? '#f85149' : '#3fb950' }} />
                    <span className="text-xs" style={{ color: factor.present ? '#f85149' : '#3fb950' }}>{factor.label}</span>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p style={sh}>Warnings</p>
                  <button onClick={() => setWarningModal(true)}
                    className="px-3 py-1.5 rounded text-xs font-medium"
                    style={{ background: 'transparent', border: '1px solid #d29922', color: '#d29922' }}>
                    + Issue Warning
                  </button>
                </div>
                {warnings === null ? <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p> : warnings.length === 0 ? (
                  <p className="text-sm" style={{ color: '#7d8fa3' }}>No warnings issued.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {warnings.map(w => (
                      <li key={w.id} className="px-4 py-3 rounded flex flex-col gap-2"
                        style={{ background: '#080b0f', border: `1px solid ${w.resolved ? '#1a2332' : '#d2992233'}`, opacity: w.resolved ? 0.6 : 1 }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <p className="text-sm" style={{ color: '#e6edf3' }}>{w.reason}</p>
                            <p className="text-xs" style={{ color: '#7d8fa3' }}>{new Date(w.issued_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge color={severityColor(w.severity)}>{w.severity}</Badge>
                            {w.resolved ? <Badge color="#3fb950">Resolved</Badge> : (
                              <button onClick={() => startTransition(async () => {
                                await resolveWarning(w.id)
                                setWarnings(await getUserWarnings(user.id))
                              })} disabled={isPending}
                                className="text-xs px-2 py-1 rounded disabled:opacity-50"
                                style={{ background: 'transparent', border: '1px solid #3fb950', color: '#3fb950' }}>
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Moderation history */}
              <div>
                <p className="mb-3" style={sh}>Full Moderation History</p>
                {modHistory === null ? (
                  <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
                ) : modHistory.length === 0 ? (
                  <p className="text-sm" style={{ color: '#7d8fa3' }}>No actions recorded.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {modHistory.map(h => (
                      <li key={h.id} className="flex items-center justify-between px-3 py-2 rounded text-xs"
                        style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                        <span style={{ color: '#e6edf3' }}>{h.action}</span>
                        <span style={{ color: '#7d8fa3' }}>{new Date(h.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* â”€â”€ TIMELINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Timeline' && (
            <div>
              {timeline === null ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>Loadingâ€¦</p>
              ) : timeline.length === 0 ? (
                <p className="text-sm" style={{ color: '#7d8fa3' }}>No timeline events.</p>
              ) : (
                <ol className="flex flex-col gap-0">
                  {timeline.map((event, i) => {
                    const isMilestone = ['â˜…','â­','âœ¦'].includes(event.icon)
                    return (
                      <li key={i} className="flex gap-4 pb-6 last:pb-0">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm shrink-0"
                            style={{ background: isMilestone ? '#bc8cff22' : '#1a2332', border: `1px solid ${isMilestone ? '#bc8cff' : '#3fb950'}`, color: isMilestone ? '#bc8cff' : '#3fb950' }}>
                            {event.icon}
                          </div>
                          {i < timeline.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: '#1a2332', minHeight: 16 }} />}
                        </div>
                        <div className="pt-1 pb-2 min-w-0">
                          <p className="text-sm" style={{ color: isMilestone ? '#bc8cff' : '#e6edf3' }}>{event.label}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                            {new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )}

          {/* â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Settings' && (
            <div className="flex flex-col gap-6">
              {/* Profile info */}
              <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p className="text-xs mb-3" style={sh}>Profile</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['ID', user.id],
                    ['Name', user.full_name ?? 'â€”'],
                    ['Email', user.email],
                    ['Country', user.country ?? 'â€”'],
                    ['Plan', user.plan ?? 'â€”'],
                    ['Stage', user.stage ?? 'â€”'],
                    ['Streak', `${user.streak ?? 0} days`],
                    ['Points', user.points ?? 0],
                    ['Status', user.status ?? 'â€”'],
                    ['Admin', user.is_admin ? 'Yes' : 'No'],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <span style={{ color: '#7d8fa3' }}>{label}: </span>
                      <span style={{ color: '#e6edf3' }}>{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Device info placeholder */}
              <div className="p-4 rounded" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p className="text-xs mb-2" style={sh}>Device Info</p>
                <p className="text-xs" style={{ color: '#7d8fa3' }}>Device info not yet stored in the database.</p>
              </div>

              {/* Additional actions */}
              <div className="p-4 rounded flex flex-col gap-2" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
                <p className="text-xs mb-1" style={sh}>Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="ghost" onClick={() => startTransition(async () => {
                    const result = await resetPassword(user.id)
                    alert(result.error ? `Error: ${result.error}` : 'Password reset link generated.')
                  })} disabled={isPending}>Reset Password</Btn>
                  <Btn variant="ghost" onClick={() => { window.location.href = `/api/export/user/${user.id}` }}>Export Data</Btn>
                  <Btn variant="ghost" onClick={async () => {
                    setImpersonateLoading(true); setImpersonateLink(null); setImpersonateModal(true)
                    setImpersonateLink(await generateImpersonationLink(user.id))
                    setImpersonateLoading(false)
                  }} disabled={isPending}>Impersonate</Btn>
                </div>
              </div>

              {/* Danger zone */}
              <div className="p-4 rounded flex flex-col gap-3" style={{ background: '#080b0f', border: '2px solid #f8514933' }}>
                <p className="text-xs font-semibold" style={{ color: '#f85149' }}>DANGER ZONE</p>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="danger" onClick={() => {
                    if (confirm('Clear ALL user data? This cannot be undone.')) {
                      startTransition(async () => {
                        await clearUserData(user.id)
                        alert('User data cleared.')
                      })
                    }
                  }} disabled={isPending}>Clear All Data</Btn>
                  <Btn variant="ghost" onClick={() => {
                    if (confirm('Anonymise this account? Name will be set to "Anonymous User" and email will be changed.')) {
                      startTransition(async () => {
                        await anonymiseAccount(user.id)
                        alert('Account anonymised.')
                        onClose()
                      })
                    }
                  }} disabled={isPending}>Anonymise Account</Btn>
                  <Btn variant="danger" onClick={() => {
                    if (confirm('Permanently delete this account? This cannot be undone.')) {
                      startTransition(async () => {
                        await deleteUser(user.id)
                        onClose()
                      })
                    }
                  }} disabled={isPending}>Delete Account</Btn>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Warning modal */}
      {warningModal && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 60, background: 'rgba(0,0,0,0.75)' }} onClick={() => setWarningModal(false)}>
          <div className="p-6 rounded-lg flex flex-col gap-4" style={{ background: '#0d1117', border: '1px solid #1a2332', width: 400 }} onClick={e => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: '#e6edf3' }}>Issue Warning</p>
            <textarea placeholder="Reason (required)" value={warningReason} onChange={e => setWarningReason(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
            <div>
              <p className="text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Severity</p>
              <div className="flex gap-2">
                {(['Low','Medium','High'] as const).map(s => (
                  <button key={s} onClick={() => setWarningSeverity(s)}
                    className="px-3 py-1.5 rounded text-xs font-medium"
                    style={{ background: warningSeverity === s ? `${severityColor(s)}22` : 'transparent', border: `1px solid ${warningSeverity === s ? severityColor(s) : '#1a2332'}`, color: warningSeverity === s ? severityColor(s) : '#7d8fa3' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setWarningModal(false)} className="px-4 py-2 rounded text-sm" style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}>Cancel</button>
              <button onClick={() => {
                if (!warningReason.trim()) return
                startTransition(async () => {
                  await issueWarning(user.id, warningReason.trim(), warningSeverity)
                  setWarnings(await getUserWarnings(user.id))
                  setWarningModal(false); setWarningReason(''); setWarningSeverity('Low')
                })
              }} disabled={isPending || !warningReason.trim()}
                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: '#d2992222', color: '#d29922', border: '1px solid #d29922' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impersonation modal */}
      {impersonateModal && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 60, background: 'rgba(0,0,0,0.75)' }} onClick={() => setImpersonateModal(false)}>
          <div className="p-6 rounded-lg flex flex-col gap-4" style={{ background: '#0d1117', border: '1px solid #1a2332', width: 460 }} onClick={e => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: '#e6edf3' }}>Impersonation Link</p>
            <div className="px-3 py-2 rounded text-xs" style={{ background: '#f8514918', border: '1px solid #f8514966', color: '#f85149' }}>
              âš  This link gives full app access as this user and expires in 1 hour. Do not share.
            </div>
            {impersonateLoading ? <p className="text-sm" style={{ color: '#7d8fa3' }}>Generating linkâ€¦</p> : impersonateLink ? (
              <div className="flex flex-col gap-2">
                <div className="px-3 py-2 rounded text-xs break-all" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#58a6ff' }}>{impersonateLink}</div>
                <button onClick={() => navigator.clipboard.writeText(impersonateLink)} className="self-start px-3 py-1.5 rounded text-xs" style={{ background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44' }}>Copy Link</button>
              </div>
            ) : <p className="text-sm" style={{ color: '#f85149' }}>Failed to generate link.</p>}
            <div className="flex justify-end">
              <button onClick={() => setImpersonateModal(false)} className="px-4 py-2 rounded text-sm" style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Streak modal */}
      {streakModal && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 60, background: 'rgba(0,0,0,0.75)' }} onClick={() => setStreakModal(false)}>
          <div className="p-6 rounded-lg flex flex-col gap-4" style={{ background: '#0d1117', border: '1px solid #1a2332', width: 380 }} onClick={e => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: '#e6edf3' }}>Reset Streak</p>
            <p className="text-xs" style={{ color: '#7d8fa3' }}>This will set the user's streak to 0. Please provide a reason.</p>
            <input type="text" placeholder="Reason" value={streakReason} onChange={e => setStreakReason(e.target.value)} style={inp} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStreakModal(false)} className="px-4 py-2 rounded text-sm" style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}>Cancel</button>
              <button onClick={() => {
                if (!streakReason.trim()) return
                startTransition(async () => {
                  await resetStreak(user.id, streakReason.trim())
                  setStreakModal(false); setStreakReason('')
                })
              }} disabled={isPending || !streakReason.trim()}
                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: '#f8514922', color: '#f85149', border: '1px solid #f85149' }}>
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

