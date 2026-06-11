'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProgressBar from '@/components/ui/ProgressBar'
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
import type { UserWithEmail } from '@/components/UserDrawer'

const C = {
  bg: '#070a0e', surface: '#0d1117', surface2: '#0f1722', elevated: '#111a26',
  dim: '#1a2332', dim2: '#243044', text: '#e6edf3', muted: '#7d8fa3', muted2: '#5a6b7d',
  green: '#3fb950', blue: '#58a6ff', purple: '#bc8cff', amber: '#d29922', red: '#f85149', cyan: '#39d0d8',
}

const STAGES = ['Seed','Sprout','Seedling','Sapling','Young Tree','Mature Tree','Ancient Tree','Legendary']
const GARDENER_PHASES = ['Phase 1','Phase 2','Phase 3','Phase 4','Phase 5','Phase 6','Phase 7','Phase 8']

const TABS = ['Overview','Activity','Habits','Nutrition','Goals','Journal','Gardener','Communications','Moderation','Timeline','Settings'] as const
type Tab = typeof TABS[number]

const inp: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.dim}`, color: C.text,
  borderRadius: 6, padding: '7px 11px', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none',
}
const sh: React.CSSProperties = {
  color: C.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 5,
      fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  )
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 18 }}>
      {title && <p style={{ ...sh, marginBottom: 14 }}>{title}</p>}
      {children}
    </div>
  )
}

function ContribGrid({ grid }: { grid: { date: string; count: number }[] }) {
  const today = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    return { date: key, count: grid.find(g => g.date === key)?.count ?? 0 }
  })
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {days.map(d => (
        <div key={d.date} title={`${d.date}: ${d.count}`} style={{
          width: 14, height: 14, borderRadius: 3,
          background: d.count === 0 ? C.dim : d.count < 3 ? C.green + '66' : C.green,
        }} />
      ))}
    </div>
  )
}

function MoodBar({ entries }: { entries: JournalData['entries'] }) {
  const today = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    return { date: key, score: entries.find(e => e.created_at.slice(0, 10) === key)?.mood_score ?? null }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 44 }}>
      {days.map(d => (
        <div key={d.date} title={`${d.date}: ${d.score ?? 'no data'}`} style={{
          width: 8, borderRadius: 2,
          height: d.score != null ? Math.max(2, (d.score / 10) * 40) : 2,
          background: d.score != null ? C.blue : C.dim,
        }} />
      ))}
    </div>
  )
}

function severityColor(s: string) {
  return s === 'High' ? C.red : s === 'Medium' ? C.amber : C.blue
}

type Props = { user: UserWithEmail }

export default function UserDetailClient({ user }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [isPending, startTransition] = useTransition()

  // Eagerly loaded
  const [warnings, setWarnings] = useState<UserWarning[] | null>(null)
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryEntry[] | null>(null)
  const [contribGrid, setContribGrid] = useState<{ date: string; count: number }[] | null>(null)
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [goals, setGoals] = useState<Goal[] | null>(null)

  // Lazy tab data
  const [habitsExt, setHabitsExt] = useState<HabitExtended[] | null>(null)
  const [goalNotes, setGoalNotes] = useState<Record<string, GoalNote[]>>({})
  const [gardener, setGardener] = useState<GardenerSummary[] | null>(null)
  const [gardenerProfile, setGardenerProfile] = useState<{ phase?: string | null } | null>(null)
  const [gardenerContext, setGardenerContext] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [userModel, setUserModel] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null)
  const [communications, setCommunications] = useState<UserCommunication[] | null>(null)
  const [notifHistory, setNotifHistory] = useState<NotificationLog[] | null>(null)
  const [adminNotes, setAdminNotes] = useState<(AdminNote & { admin_name: string | null })[] | null>(null)
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
    if (tab === 'Activity' && activity === null) startTransition(async () => setActivity(await getUserActivityFeed(user.id)))
    if (tab === 'Habits' && habitsExt === null) startTransition(async () => setHabitsExt(await getUserHabitsExtended(user.id)))
    if (tab === 'Nutrition' && nutrition === null) startTransition(async () => setNutrition(await getUserNutritionData(user.id)))
    if (tab === 'Goals' && goals === null) startTransition(async () => setGoals(await getUserGoals(user.id)))
    if (tab === 'Journal' && journal === null) startTransition(async () => setJournal(await getUserJournalData(user.id)))
    if (tab === 'Gardener' && gardener === null) startTransition(async () => {
      const [g, gp, gc, um] = await Promise.all([getUserGardener(user.id), getGardenerProfile(user.id), getGardenerContext(user.id), getUserModel(user.id)])
      setGardener(g); setGardenerProfile(gp); setGardenerContext(gc); setUserModel(um)
      if (gp?.phase) setGardenerPhase(gp.phase ?? '')
    })
    if (tab === 'Timeline' && timeline === null) startTransition(async () => setTimeline(await getUserTimeline(user.id)))
    if (tab === 'Communications' && communications === null) startTransition(async () => {
      const [comms, notifs, notes] = await Promise.all([getUserCommunications(user.id), getUserNotificationHistory(user.id), getAdminNotes(user.id)])
      setCommunications(comms); setNotifHistory(notifs); setAdminNotes(notes)
    })
    if (tab === 'Moderation' && modHistory === null) startTransition(async () => {
      const h = await getUserModerationHistory(user.id)
      setModHistory(h as { id: string; action: string; created_at: string }[])
    })
  }

  const isSuspended = user.status === 'suspended'
  const isPro = user.plan === 'pro'
  const riskColor = user.riskScore <= 2 ? C.green : user.riskScore <= 5 ? C.amber : C.red
  const riskLabel = user.riskScore <= 2 ? 'Low' : user.riskScore <= 5 ? 'Medium' : 'High'
  const unresolvedWarnings = warnings?.filter(w => !w.resolved) ?? []
  const showEscalationBanner = warnings !== null && unresolvedWarnings.length >= 3
  const totalCompletions = contribGrid?.reduce((s, g) => s + g.count, 0) ?? 0
  const engagementScore = Math.round((user.streak ?? 0) * 2 + (user.points ?? 0) / 100 + totalCompletions * 0.5)

  return (
    <div style={{ minHeight: '100%', fontFamily: 'inherit' }}>
      {/* Escalation banner */}
      {showEscalationBanner && (
        <div style={{ padding: '10px 0', marginBottom: 20, background: C.red + '18', border: `1px solid ${C.red}66`, borderRadius: 8, paddingLeft: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.red }}>
            ⚠ {unresolvedWarnings.length} unresolved warnings — consider escalation to permanent ban
          </p>
        </div>
      )}

      {/* Back nav */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/users" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, textDecoration: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Users
        </Link>
      </div>

      {/* Page header */}
      <div style={{ background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: isPro ? C.purple + '22' : C.green + '18',
              border: `2px solid ${isPro ? C.purple + '66' : C.green + '44'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: isPro ? C.purple : C.green,
            }}>
              {(user.full_name ?? user.email)[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>{user.full_name ?? '—'}</h1>
              <p style={{ margin: '2px 0 8px', fontSize: 13, color: C.muted }}>{user.email}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge color={isPro ? C.purple : C.muted}>{user.plan ?? 'free'}</Badge>
                <Badge color={isSuspended ? C.red : C.green}>{user.status ?? 'active'}</Badge>
                <Badge color={riskColor}>{riskLabel} Risk · {user.riskScore}</Badge>
                {(warnings?.filter(w => !w.resolved).length ?? 0) > 0 && (
                  <Badge color={C.red}>{warnings!.filter(w => !w.resolved).length} warnings</Badge>
                )}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12, color: C.muted }}>
            <p>Joined {new Date(user.created_at).toLocaleDateString()}</p>
            {user.last_sign_in_at && <p>Last active {new Date(user.last_sign_in_at).toLocaleDateString()}</p>}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 0, paddingTop: 16, borderTop: `1px solid ${C.dim}`, overflowX: 'auto' }}>
          {[
            { label: 'Streak', value: `${user.streak ?? 0}d`, color: C.green },
            { label: 'Points', value: (user.points ?? 0).toLocaleString(), color: C.blue },
            { label: 'Stage', value: user.stage ?? '—', color: C.purple },
            { label: 'Habits', value: habits?.length ?? '…', color: C.text },
            { label: 'Goals', value: goals?.length ?? '…', color: C.text },
            { label: 'Completions', value: totalCompletions, color: C.green },
            { label: 'Engagement', value: engagementScore, color: C.amber },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: '1 0 auto', textAlign: 'center', padding: '0 16px', borderRight: i < 6 ? `1px solid ${C.dim}` : 'none' }}>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: C.surface, borderRadius: 10, border: `1px solid ${C.dim}`, padding: '0 4px', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => switchTab(tab)} style={{
            padding: '12px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: 'transparent', border: 'none', whiteSpace: 'nowrap', transition: 'color 0.12s',
            color: activeTab === tab ? C.green : C.muted,
            borderBottom: activeTab === tab ? `2px solid ${C.green}` : '2px solid transparent',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Contribution grid */}
            <Card title="30-Day Completion History">
              <div style={{ padding: 14, borderRadius: 8, background: C.bg, border: `1px solid ${C.dim}` }}>
                <ContribGrid grid={contribGrid ?? []} />
                <p style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>{totalCompletions} completions in last 30 days</p>
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {/* Engagement */}
              <div style={{ background: C.bg, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 16 }}>
                <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Engagement Score</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: C.amber, lineHeight: 1 }}>{engagementScore}</p>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>streak×2 + pts/100 + completions×0.5</p>
              </div>

              {/* Points breakdown */}
              <div style={{ background: C.bg, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 16 }}>
                <p style={{ ...sh, marginBottom: 10 }}>Points Breakdown</p>
                {pointsHistory && pointsHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {pointsHistory.slice(0, 6).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{p.reason ?? '—'}</span>
                        <span style={{ color: p.amount >= 0 ? C.green : C.red, fontWeight: 600 }}>{p.amount >= 0 ? '+' : ''}{p.amount}</span>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ fontSize: 12, color: C.muted }}>No history.</p>}
              </div>

              {/* Quick actions */}
              <div style={{ background: C.bg, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 16 }}>
                <p style={{ ...sh, marginBottom: 10 }}>Actions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button disabled={isPending} onClick={() => startTransition(async () => { await (isSuspended ? restoreUser(user.id) : suspendUser(user.id)) })} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: isSuspended ? 'transparent' : C.red + '22', border: `1px solid ${isSuspended ? C.dim2 : C.red + '44'}`, color: isSuspended ? C.muted : C.red }}>
                    {isSuspended ? 'Restore' : 'Suspend'}
                  </button>
                  <button disabled={isPending} onClick={() => startTransition(async () => { await (isPro ? revokePro(user.id) : grantPro(user.id)) })} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.purple + '22', border: `1px solid ${C.purple}44`, color: C.purple }}>
                    {isPro ? 'Revoke Pro' : 'Grant Pro'}
                  </button>
                  <button onClick={() => setWarningModal(true)} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.dim2}`, color: C.muted }}>
                    Issue Warning
                  </button>
                </div>
              </div>
            </div>

            {/* Points adjustment */}
            <Card title="Adjust Points">
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" placeholder="±amount" value={pointAmount} onChange={e => setPointAmount(e.target.value)} style={{ ...inp, width: 110 }} />
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
                  style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.text, whiteSpace: 'nowrap', opacity: isPending || !pointAmount || !pointReason.trim() ? 0.5 : 1 }}>
                  Apply
                </button>
              </div>
            </Card>

            {/* Stage + streak */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card>
                <p style={{ ...sh, marginBottom: 10 }}>Stage</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} style={inp}>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => startTransition(async () => { await setStage(user.id, selectedStage) })} disabled={isPending} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.purple + '22', border: `1px solid ${C.purple}44`, color: C.purple, whiteSpace: 'nowrap', opacity: isPending ? 0.5 : 1 }}>
                    Apply
                  </button>
                </div>
              </Card>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ ...sh, marginBottom: 4 }}>Streak</p>
                    <p style={{ fontSize: 13, color: C.text }}>Current: {user.streak ?? 0} days</p>
                  </div>
                  <button onClick={() => setStreakModal(true)} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.red}`, color: C.red }}>
                    Reset Streak
                  </button>
                </div>
              </Card>
            </div>

            {/* Appeal */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Appeal status:</span>
                <select value={appealStatus} onChange={e => setAppealStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
                  <option value="none">None</option>
                  <option value="appealing">Under Appeal</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button onClick={() => startTransition(async () => { await saveAppealStatus(user.id, appealStatus) })} disabled={isPending} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.dim2}`, color: C.muted, opacity: isPending ? 0.5 : 1 }}>
                  Set
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* ── ACTIVITY ────────────────────────────────────────────────────── */}
        {activeTab === 'Activity' && (
          <Card>
            {activity === null ? (
              <p style={{ fontSize: 13, color: C.muted }}>Loading…</p>
            ) : activity.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted }}>No activity recorded.</p>
            ) : (
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {activity.map((event, i) => (
                  <li key={i} style={{ display: 'flex', gap: 16, paddingBottom: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.surface, border: `1px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.green }}>{event.icon}</div>
                      {i < activity.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 4, background: C.dim, minHeight: 12 }} />}
                    </div>
                    <div style={{ paddingTop: 4 }}>
                      <p style={{ fontSize: 13, color: C.text }}>{event.label}</p>
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{new Date(event.date).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}

        {/* ── HABITS ──────────────────────────────────────────────────────── */}
        {activeTab === 'Habits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {habitsExt === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> :
              habitsExt.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No habits.</p> :
                habitsExt.map(h => (
                  <Card key={h.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{h.name}</p>
                        {h.category && <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{h.category}</p>}
                      </div>
                      <button onClick={() => { if (confirm('Delete this habit?')) { startTransition(async () => { await deleteHabit(h.id); setHabitsExt(p => p?.filter(x => x.id !== h.id) ?? null) }) } }} disabled={isPending} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.red}`, color: C.red, opacity: isPending ? 0.5 : 1 }}>Delete</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12, marginBottom: 10 }}>
                      <div><span style={{ color: C.muted }}>Completions: </span><span style={{ color: C.text }}>{h.totalCompletions}</span></div>
                      <div><span style={{ color: C.muted }}>Last: </span><span style={{ color: C.text }}>{h.lastCompleted ? new Date(h.lastCompleted).toLocaleDateString() : '—'}</span></div>
                      <div><span style={{ color: C.muted }}>Created: </span><span style={{ color: C.text }}>{new Date(h.created_at).toLocaleDateString()}</span></div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: C.muted }}>30-day completion rate</span>
                        <span style={{ color: C.green }}>{h.completionRate30}%</span>
                      </div>
                      <ProgressBar value={h.completionRate30} color={C.green} />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>30-day calendar</p>
                      <ContribGrid grid={Array.from({ length: 30 }, (_, i) => {
                        const d = new Date(); d.setDate(d.getDate() - (29 - i))
                        const date = d.toISOString().slice(0, 10)
                        return { date, count: h.completionDates.includes(date) ? 1 : 0 }
                      })} />
                    </div>
                  </Card>
                ))
            }
          </div>
        )}

        {/* ── NUTRITION ───────────────────────────────────────────────────── */}
        {activeTab === 'Nutrition' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {nutrition === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[['Avg Calories/Day', nutrition.macros.calories, C.amber, '7-day avg'],['Avg Protein/Day', nutrition.macros.protein + 'g', C.green,''],['Avg Carbs/Day', nutrition.macros.carbs + 'g', C.blue,''],['Avg Fat/Day', nutrition.macros.fat + 'g', C.purple,'']].map(([label, value, color, sub]) => (
                    <div key={label as string} style={{ background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 16 }}>
                      <p style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{label as string}</p>
                      <p style={{ fontSize: 24, fontWeight: 700, color: color as string, lineHeight: 1 }}>{value as string}</p>
                      {sub && <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub as string}</p>}
                    </div>
                  ))}
                </div>
                <Card title="Water Goal Hit Rate (30 days)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}><ProgressBar value={nutrition.waterHitRate} color={C.cyan} /></div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.cyan, flexShrink: 0 }}>{nutrition.waterHitRate}%</span>
                  </div>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Card title="Top Logged Foods">
                    {nutrition.topFoods.length === 0 ? <p style={{ fontSize: 12, color: C.muted }}>No data.</p> :
                      <ol style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {nutrition.topFoods.map((f, i) => (
                          <li key={f.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: C.text }}>{i + 1}. {f.name}</span>
                            <span style={{ color: C.muted }}>{f.count}×</span>
                          </li>
                        ))}
                      </ol>}
                  </Card>
                  <Card title="Body Logs">
                    {nutrition.bodyLogs.length === 0 ? <p style={{ fontSize: 12, color: C.muted }}>No body logs.</p> :
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <tbody>
                          {nutrition.bodyLogs.slice(0, 8).map((b, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.dim}` }}>
                              <td style={{ padding: '6px 8px 6px 0', color: C.muted }}>{new Date(b.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '6px 0', color: C.text }}>{b.weight != null ? `${b.weight}${b.weight_unit ?? 'kg'}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>}
                  </Card>
                </div>
                <Card title="Meal Suggestion History">
                  {nutrition.mealSuggestions.length === 0 ? <p style={{ fontSize: 12, color: C.muted }}>No meal suggestions.</p> :
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {nutrition.mealSuggestions.map(m => (
                        <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.meal_name ?? '—'}</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                            {m.flagged && <Badge color={C.red}>Flagged</Badge>}
                            <span style={{ color: C.muted }}>{new Date(m.created_at).toLocaleDateString()}</span>
                          </div>
                        </li>
                      ))}
                    </ul>}
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── GOALS ────────────────────────────────────────────────────────── */}
        {activeTab === 'Goals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goals === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> :
              goals.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No goals.</p> :
                goals.map(g => (
                  <Card key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{g.title}</p>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {g.category && <Badge color={C.muted}>{g.category}</Badge>}
                          {g.status && <Badge color={g.status === 'completed' ? C.green : g.status === 'in_progress' ? C.blue : C.muted}>{g.status}</Badge>}
                          {g.gardener_linked && <Badge color={C.purple}>Gardener</Badge>}
                        </div>
                      </div>
                      <button onClick={() => { if (confirm('Delete?')) { startTransition(async () => { await deleteGoal(g.id); setGoals(p => p?.filter(x => x.id !== g.id) ?? null) }) } }} disabled={isPending} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.red}`, color: C.red, opacity: isPending ? 0.5 : 1 }}>Delete</button>
                    </div>
                    <ProgressBar value={g.progress ?? 0} color={g.status === 'completed' ? C.green : C.blue} />
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Created {new Date(g.created_at).toLocaleDateString()}</p>
                    <div style={{ marginTop: 12 }}>
                      <p style={{ ...sh, marginBottom: 8 }}>Admin Notes</p>
                      {(goalNotes[g.id] ?? []).map(n => (
                        <div key={n.id} style={{ padding: '8px 12px', borderRadius: 6, background: C.surface, border: `1px solid ${C.dim}`, marginBottom: 6, fontSize: 12 }}>
                          <p style={{ color: C.text }}>{n.note}</p>
                          <p style={{ color: C.muted, marginTop: 3 }}>{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input type="text" placeholder="Add a note…" value={newGoalNote[g.id] ?? ''} onChange={e => setNewGoalNote(p => ({ ...p, [g.id]: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                        <button onClick={() => {
                          const note = newGoalNote[g.id]?.trim()
                          if (!note) return
                          startTransition(async () => { await addGoalNote(g.id, note); const notes = await getGoalNotes(g.id); setGoalNotes(p => ({ ...p, [g.id]: notes })); setNewGoalNote(p => ({ ...p, [g.id]: '' })) })
                        }} disabled={isPending || !newGoalNote[g.id]?.trim()} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.text, whiteSpace: 'nowrap', opacity: isPending || !newGoalNote[g.id]?.trim() ? 0.5 : 1 }}>Add</button>
                      </div>
                      {!goalNotes[g.id] && (
                        <button onClick={() => startTransition(async () => { const notes = await getGoalNotes(g.id); setGoalNotes(p => ({ ...p, [g.id]: notes })) })} style={{ fontSize: 12, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>Load notes</button>
                      )}
                    </div>
                  </Card>
                ))
            }
          </div>
        )}

        {/* ── JOURNAL ──────────────────────────────────────────────────────── */}
        {activeTab === 'Journal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {journal === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> : (
              <>
                <Card title="30-Day Mood">
                  <MoodBar entries={journal.entries} />
                  <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 12 }}>
                    <div><span style={{ color: C.muted }}>Avg mood: </span><span style={{ color: C.blue }}>{journal.avgMood}/10</span></div>
                    <div><span style={{ color: C.muted }}>Entries: </span><span style={{ color: C.text }}>{journal.entries.length}</span></div>
                  </div>
                </Card>
                <Card title="Entries per Week">
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <tbody>
                      {journal.weekCounts.map(w => (
                        <tr key={w.week} style={{ borderBottom: `1px solid ${C.dim}` }}>
                          <td style={{ padding: '7px 0', color: C.muted }}>Week of {new Date(w.week).toLocaleDateString()}</td>
                          <td style={{ padding: '7px 0', color: C.text, fontWeight: 600 }}>{w.count} entries</td>
                        </tr>
                      ))}
                      {journal.weekCounts.length === 0 && <tr><td colSpan={2} style={{ padding: 16, textAlign: 'center', color: C.muted }}>No data.</td></tr>}
                    </tbody>
                  </table>
                </Card>
                {journal.entries.filter(e => e.flagged).length > 0 && (
                  <div>
                    <p style={{ ...sh, marginBottom: 12 }}>Flagged Entries</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {journal.entries.filter(e => e.flagged).map(e => (
                        <div key={e.id} style={{ padding: '14px 16px', borderRadius: 10, background: C.bg, border: `1px solid ${C.red}33` }}>
                          <p style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>{e.content ?? '(no content)'}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontSize: 11, color: C.muted }}>Mood: {e.mood_score ?? '—'}/10 · {new Date(e.created_at).toLocaleString()}</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => startTransition(async () => { await unflagJournalEntry(e.id); setJournal(p => p ? { ...p, entries: p.entries.map(x => x.id === e.id ? { ...x, flagged: false } : x) } : null) })} disabled={isPending} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.green}`, color: C.green, opacity: isPending ? 0.5 : 1 }}>Unflag</button>
                              <button onClick={() => { if (confirm('Delete entry?')) { startTransition(async () => { await deleteJournalEntry(e.id); setJournal(p => p ? { ...p, entries: p.entries.filter(x => x.id !== e.id) } : null) }) } }} disabled={isPending} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.red}`, color: C.red, opacity: isPending ? 0.5 : 1 }}>Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── GARDENER ─────────────────────────────────────────────────────── */}
        {activeTab === 'Gardener' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Phase Progression">
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {GARDENER_PHASES.map((phase, i) => {
                  const currentIdx = GARDENER_PHASES.indexOf(gardenerProfile?.phase ?? '')
                  return <div key={phase} style={{ flex: 1, height: 8, borderRadius: 4, background: i <= currentIdx ? C.purple : C.dim }} title={phase} />
                })}
              </div>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Current: {gardenerProfile?.phase ?? 'Unknown'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={gardenerPhase} onChange={e => setGardenerPhase(e.target.value)} style={{ ...inp, width: 160 }}>
                  {GARDENER_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => startTransition(async () => { await setGardenerPhaseAction(user.id, gardenerPhase); setGardenerProfile(p => ({ ...p, phase: gardenerPhase })) })} disabled={isPending} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.purple + '22', border: `1px solid ${C.purple}44`, color: C.purple, opacity: isPending ? 0.5 : 1 }}>Set Phase</button>
              </div>
            </Card>

            {(gardenerContext !== undefined || userModel !== undefined) && (
              <Card title="Context Snapshot">
                {gardenerContext === null && userModel === null ? (
                  <p style={{ fontSize: 12, color: C.muted }}>No context snapshot built yet — run the intelligence pipeline.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {userModel && (<>
                      <div><p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Data Confidence</p><p style={{ fontSize: 14, fontWeight: 600, color: Number(userModel.data_confidence_score ?? 0) < 30 ? C.red : Number(userModel.data_confidence_score ?? 0) < 60 ? C.amber : C.green }}>{userModel.data_confidence_score != null ? String(userModel.data_confidence_score) : '—'}</p></div>
                      <div><p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Active Day Rate</p><p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{userModel.active_day_rate != null ? `${Math.round(Number(userModel.active_day_rate) * 100)}%` : '—'}</p></div>
                      <div><p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Voice Register</p><p style={{ fontSize: 14, fontWeight: 600, color: C.purple }}>{userModel.voice_register != null ? String(userModel.voice_register) : '—'}</p></div>
                      {userModel.key_action_today && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Today's Key Action</p>
                          <p style={{ fontSize: 12, fontStyle: 'italic', color: C.text }}>{String(userModel.key_action_today)}</p>
                        </div>
                      )}
                    </>)}
                  </div>
                )}
              </Card>
            )}

            {gardener === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> :
              gardener.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No summaries.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={sh}>Summaries</p>
                  {gardener.map(entry => (
                    <div key={entry.id} style={{ padding: '14px 16px', borderRadius: 10, background: C.bg, border: `1px solid ${C.dim}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {entry.phase && <Badge color={C.purple}>{entry.phase}</Badge>}
                          {entry.prompt_version && <Badge color={C.muted}>v{entry.prompt_version}</Badge>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {entry.flagged && <Badge color={C.red}>Flagged</Badge>}
                          <span style={{ fontSize: 11, color: C.muted }}>{new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {entry.summary && <p style={{ fontSize: 13, color: C.text }}>{entry.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* ── COMMUNICATIONS ───────────────────────────────────────────────── */}
        {activeTab === 'Communications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Email">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="text" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} style={inp} />
                <textarea placeholder="Body" value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
                <button onClick={() => { if (!emailSubject.trim() || !emailBody.trim()) return; startTransition(async () => { await sendUserEmail(user.id, emailSubject.trim(), emailBody.trim()); setCommunications(await getUserCommunications(user.id)); setEmailSubject(''); setEmailBody('') }) }} disabled={isPending || !emailSubject.trim() || !emailBody.trim()} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.blue + '22', border: `1px solid ${C.blue}44`, color: C.blue, opacity: isPending || !emailSubject.trim() || !emailBody.trim() ? 0.5 : 1 }}>Send Email</button>
              </div>
            </Card>

            <Card title="Push Notification">
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Message" value={pushMessage} onChange={e => setPushMessage(e.target.value)} style={inp} />
                <button onClick={() => { if (!pushMessage.trim()) return; startTransition(async () => { await sendUserPush(user.id, pushMessage.trim()); setCommunications(await getUserCommunications(user.id)); setPushMessage('') }) }} disabled={isPending || !pushMessage.trim()} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.green + '22', border: `1px solid ${C.green}44`, color: C.green, whiteSpace: 'nowrap', opacity: isPending || !pushMessage.trim() ? 0.5 : 1 }}>Send Push</button>
              </div>
            </Card>

            <Card title="Admin Notes">
              {adminNotes === null ? <p style={{ fontSize: 12, color: C.muted }}>Loading…</p> : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {adminNotes.map(n => (
                      <div key={n.id} style={{ padding: '10px 14px', borderRadius: 8, background: C.bg, border: `1px solid ${C.dim}` }}>
                        <p style={{ fontSize: 13, color: C.text }}>{n.note}</p>
                        <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{n.admin_name ?? 'Admin'} · {new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <textarea placeholder="Write an internal admin note…" value={adminNoteText} onChange={e => setAdminNoteText(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 10 }} />
                  <button onClick={() => { if (!adminNoteText.trim()) return; startTransition(async () => { await saveAdminNote(user.id, adminNoteText.trim()); setAdminNotes(await getAdminNotes(user.id)); setAdminNoteText('') }) }} disabled={isPending || !adminNoteText.trim()} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.text, opacity: isPending || !adminNoteText.trim() ? 0.5 : 1 }}>Save Note</button>
                </>
              )}
            </Card>

            {communications !== null && (
              <Card title="Sent History">
                {communications.length === 0 ? <p style={{ fontSize: 12, color: C.muted }}>Nothing sent yet.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {communications.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: C.bg, border: `1px solid ${C.dim}` }}>
                        <div>
                          <p style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{c.subject ?? c.body?.slice(0, 60) ?? '—'}</p>
                          <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{c.type} · {new Date(c.sent_at).toLocaleString()}</p>
                        </div>
                        <Badge color={C.muted}>{c.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ── MODERATION ───────────────────────────────────────────────────── */}
        {activeTab === 'Moderation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Risk Assessment">
              {[
                { label: 'Streak = 0', present: (user.streak ?? 0) === 0 },
                { label: 'Multiple warnings (3+)', present: (user.warnings ?? 0) >= 3 },
                { label: 'Account suspended', present: user.status === 'suspended' },
                { label: 'Has unresolved warnings', present: unresolvedWarnings.length > 0 },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.present ? C.red : C.green, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: f.present ? C.red : C.green }}>{f.label}</span>
                </div>
              ))}
            </Card>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={sh}>Warnings</p>
                <button onClick={() => setWarningModal(true)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.amber}`, color: C.amber }}>+ Issue Warning</button>
              </div>
              {warnings === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> :
                warnings.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No warnings issued.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {warnings.map(w => (
                      <div key={w.id} style={{ padding: '14px 16px', borderRadius: 10, background: C.bg, border: `1px solid ${w.resolved ? C.dim : C.amber + '33'}`, opacity: w.resolved ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <p style={{ fontSize: 13, color: C.text }}>{w.reason}</p>
                            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{new Date(w.issued_at).toLocaleDateString()}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <Badge color={severityColor(w.severity)}>{w.severity}</Badge>
                            {w.resolved ? <Badge color={C.green}>Resolved</Badge> : (
                              <button onClick={() => startTransition(async () => { await resolveWarning(w.id); setWarnings(await getUserWarnings(user.id)) })} disabled={isPending} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.green}`, color: C.green, opacity: isPending ? 0.5 : 1 }}>Resolve</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <Card title="Full Moderation History">
              {modHistory === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> :
                modHistory.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No actions recorded.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {modHistory.map(h => (
                      <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, background: C.bg, border: `1px solid ${C.dim}`, fontSize: 12 }}>
                        <span style={{ color: C.text }}>{h.action}</span>
                        <span style={{ color: C.muted }}>{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          </div>
        )}

        {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
        {activeTab === 'Timeline' && (
          <Card>
            {timeline === null ? <p style={{ fontSize: 13, color: C.muted }}>Loading…</p> :
              timeline.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No timeline events.</p> : (
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {timeline.map((event, i) => {
                    const isMilestone = ['★','⭐','✦'].includes(event.icon)
                    return (
                      <li key={i} style={{ display: 'flex', gap: 16, paddingBottom: 24 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: isMilestone ? C.purple + '22' : C.surface, border: `1px solid ${isMilestone ? C.purple : C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: isMilestone ? C.purple : C.green }}>{event.icon}</div>
                          {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 4, background: C.dim, minHeight: 16 }} />}
                        </div>
                        <div style={{ paddingTop: 4 }}>
                          <p style={{ fontSize: 13, color: isMilestone ? C.purple : C.text }}>{event.label}</p>
                          <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
          </Card>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {activeTab === 'Settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Profile">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13 }}>
                {[['ID', user.id],['Name', user.full_name ?? '—'],['Email', user.email],['Country', user.country ?? '—'],['Plan', user.plan ?? '—'],['Stage', user.stage ?? '—'],['Streak', `${user.streak ?? 0} days`],['Points', user.points ?? 0],['Status', user.status ?? '—'],['Admin', user.is_admin ? 'Yes' : 'No']].map(([label, value]) => (
                  <div key={label as string} style={{ padding: '8px 12px', borderRadius: 6, background: C.bg, border: `1px solid ${C.dim}` }}>
                    <span style={{ color: C.muted }}>{label}: </span>
                    <span style={{ color: C.text }}>{value as string}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Actions">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => startTransition(async () => { const r = await resetPassword(user.id); alert(r.error ? `Error: ${r.error}` : 'Password reset link generated.') })} disabled={isPending} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.text, opacity: isPending ? 0.5 : 1 }}>Reset Password</button>
                <button onClick={() => { window.location.href = `/api/export/user/${user.id}` }} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.text }}>Export Data</button>
                <button onClick={async () => { setImpersonateLoading(true); setImpersonateLink(null); setImpersonateModal(true); setImpersonateLink(await generateImpersonationLink(user.id)); setImpersonateLoading(false) }} disabled={isPending} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.text, opacity: isPending ? 0.5 : 1 }}>Impersonate</button>
              </div>
            </Card>

            <Card>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 14 }}>DANGER ZONE</p>
              <div style={{ padding: 16, border: `2px solid ${C.red}33`, borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { if (confirm('Clear ALL user data? This cannot be undone.')) { startTransition(async () => { await clearUserData(user.id); alert('User data cleared.') }) } }} disabled={isPending} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.red + '22', border: `1px solid ${C.red}44`, color: C.red, opacity: isPending ? 0.5 : 1 }}>Clear All Data</button>
                <button onClick={() => { if (confirm('Anonymise this account?')) { startTransition(async () => { await anonymiseAccount(user.id); alert('Account anonymised.'); router.push('/users') }) } }} disabled={isPending} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.surface, border: `1px solid ${C.dim2}`, color: C.muted, opacity: isPending ? 0.5 : 1 }}>Anonymise Account</button>
                <button onClick={() => { if (confirm('Permanently delete this account? This cannot be undone.')) { startTransition(async () => { await deleteUser(user.id); router.push('/users') }) } }} disabled={isPending} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.red + '22', border: `1px solid ${C.red}44`, color: C.red, opacity: isPending ? 0.5 : 1 }}>Delete Account</button>
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* Warning modal */}
      {warningModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setWarningModal(false)}>
          <div style={{ padding: 24, borderRadius: 12, background: C.surface, border: `1px solid ${C.dim}`, width: 400, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Issue Warning</p>
            <textarea placeholder="Reason (required)" value={warningReason} onChange={e => setWarningReason(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
            <div>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Severity</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Low','Medium','High'] as const).map(s => (
                  <button key={s} onClick={() => setWarningSeverity(s)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: warningSeverity === s ? severityColor(s) + '22' : 'transparent', border: `1px solid ${warningSeverity === s ? severityColor(s) : C.dim}`, color: warningSeverity === s ? severityColor(s) : C.muted }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setWarningModal(false)} style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.dim}`, color: C.muted }}>Cancel</button>
              <button onClick={() => { if (!warningReason.trim()) return; startTransition(async () => { await issueWarning(user.id, warningReason.trim(), warningSeverity); setWarnings(await getUserWarnings(user.id)); setWarningModal(false); setWarningReason(''); setWarningSeverity('Low') }) }} disabled={isPending || !warningReason.trim()} style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.amber + '22', border: `1px solid ${C.amber}`, color: C.amber, opacity: isPending || !warningReason.trim() ? 0.5 : 1 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Impersonation modal */}
      {impersonateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setImpersonateModal(false)}>
          <div style={{ padding: 24, borderRadius: 12, background: C.surface, border: `1px solid ${C.dim}`, width: 460, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Impersonation Link</p>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: C.red + '18', border: `1px solid ${C.red}66`, fontSize: 12, color: C.red }}>⚠ This link gives full app access as this user and expires in 1 hour. Do not share.</div>
            {impersonateLoading ? <p style={{ fontSize: 13, color: C.muted }}>Generating link…</p> : impersonateLink ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: C.bg, border: `1px solid ${C.dim}`, fontSize: 11, color: C.blue, wordBreak: 'break-all' }}>{impersonateLink}</div>
                <button onClick={() => navigator.clipboard.writeText(impersonateLink!)} style={{ alignSelf: 'flex-start', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: C.blue + '22', border: `1px solid ${C.blue}44`, color: C.blue }}>Copy Link</button>
              </div>
            ) : <p style={{ fontSize: 13, color: C.red }}>Failed to generate link.</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setImpersonateModal(false)} style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.dim}`, color: C.muted }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Streak modal */}
      {streakModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setStreakModal(false)}>
          <div style={{ padding: 24, borderRadius: 12, background: C.surface, border: `1px solid ${C.dim}`, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Reset Streak</p>
            <p style={{ fontSize: 13, color: C.muted }}>This will set the user's streak to 0. Please provide a reason.</p>
            <input type="text" placeholder="Reason" value={streakReason} onChange={e => setStreakReason(e.target.value)} style={inp} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStreakModal(false)} style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.dim}`, color: C.muted }}>Cancel</button>
              <button onClick={() => { if (!streakReason.trim()) return; startTransition(async () => { await resetStreak(user.id, streakReason.trim()); setStreakModal(false); setStreakReason('') }) }} disabled={isPending || !streakReason.trim()} style={{ padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: C.red + '22', border: `1px solid ${C.red}`, color: C.red, opacity: isPending || !streakReason.trim() ? 0.5 : 1 }}>Confirm Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
