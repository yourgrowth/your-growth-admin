'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  Habit,
  Goal,
  GardenerSummary,
  NotificationLog,
  UserCommunication,
  UserWarning,
  PointsHistoryEntry,
  GoalNote,
  AdminNote,
} from '@/types/database'


async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Verify the caller has admin privileges (defence-in-depth beyond middleware)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return null
  return user.id
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(value: string): void {
  if (!UUID_REGEX.test(value)) throw new Error('Invalid ID')
}

async function auditLog(adminId: string, action: string, targetUserId: string) {
  // Use admin client so RLS never blocks audit writes
  const admin = createAdminClient()
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    metadata: {},
  })
}

export async function suspendUser(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'suspended' }).eq('id', userId)
  await auditLog(adminId, 'suspend_user', userId)
  revalidatePath('/users')
}

export async function restoreUser(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'active' }).eq('id', userId)
  await auditLog(adminId, 'restore_user', userId)
  revalidatePath('/users')
}

export async function grantPro(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  // Write to subscription_status — the sync trigger keeps `plan` in sync
  await admin.from('profiles').update({ plan: 'pro' }).eq('id', userId)
  await auditLog(adminId, 'grant_pro', userId)
  revalidatePath('/users')
}

export async function revokePro(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ plan: 'free' }).eq('id', userId)
  await auditLog(adminId, 'revoke_pro', userId)
  revalidatePath('/users')
}

export async function deleteUser(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const adminClient = createAdminClient()
  await adminClient.auth.admin.deleteUser(userId)
  await auditLog(adminId, 'delete_user', userId)
  revalidatePath('/users')
}

export async function getUserHabits(userId: string): Promise<Habit[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('habits').select('*').eq('user_id', userId)
  return data ?? []
}

export async function getUserGoals(userId: string): Promise<Goal[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('goals').select('*').eq('user_id', userId)
  return data ?? []
}

export async function getUserGardener(userId: string): Promise<GardenerSummary[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('gardener_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export type TimelineEvent = {
  date: string
  label: string
  icon: string
}

export async function getUserTimeline(userId: string): Promise<TimelineEvent[]> {
  const admin = createAdminClient()

  const [
    { data: profile },
    { data: habits },
    { data: goals },
    { data: gardenerFirst },
    { data: proLog },
  ] = await Promise.all([
    admin.from('profiles').select('created_at').eq('id', userId).single(),
    admin.from('habits').select('id, name, created_at').eq('user_id', userId),
    admin.from('goals').select('title, created_at').eq('user_id', userId),
    admin
      .from('gardener_summaries')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),
    admin
      .from('admin_audit_log')
      .select('created_at')
      .eq('action', 'grant_pro')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  const events: TimelineEvent[] = []

  if (profile?.created_at) {
    events.push({ date: profile.created_at, label: 'Signed Up', icon: '◎' })
  }

  const habitList = habits ?? []

  if (habitList.length > 0) {
    const { data: completions } = await admin
      .from('completions')
      .select('habit_id, completed_at')
      .in(
        'habit_id',
        habitList.map((h) => h.id),
      )
      .order('completed_at', { ascending: true })

    const firstCompletion = new Map<string, string>()
    for (const c of completions ?? []) {
      if (c.habit_id && !firstCompletion.has(c.habit_id)) firstCompletion.set(c.habit_id, c.completed_at)
    }

    for (const h of habitList) {
      events.push({ date: h.created_at, label: `Created habit: ${h.name}`, icon: '✓' })
      const fc = firstCompletion.get(h.id)
      if (fc) events.push({ date: fc, label: `First completed: ${h.name}`, icon: '★' })
    }
  }

  for (const g of goals ?? []) {
    events.push({ date: g.created_at, label: `Set goal: ${g.title}`, icon: '◇' })
  }

  if (gardenerFirst?.[0]) {
    events.push({ date: gardenerFirst[0].created_at, label: 'Gardener activated', icon: '✦' })
  }

  if (proLog?.[0]) {
    events.push({ date: proLog[0].created_at, label: 'Went Pro', icon: '⭐' })
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return events
}

export async function bulkSuspend(userIds: string[]) {
  const adminId = await getAdminId()
  if (!adminId || userIds.length === 0) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'suspended' }).in('id', userIds)
  for (const id of userIds) await auditLog(adminId, 'bulk_suspend', id)
  revalidatePath('/users')
}

export async function bulkGrantPro(userIds: string[]) {
  const adminId = await getAdminId()
  if (!adminId || userIds.length === 0) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ plan: 'pro' }).in('id', userIds)
  for (const id of userIds) await auditLog(adminId, 'bulk_grant_pro', id)
  revalidatePath('/users')
}

export async function bulkRevokePro(userIds: string[]) {
  const adminId = await getAdminId()
  if (!adminId || userIds.length === 0) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ plan: 'free' }).in('id', userIds)
  for (const id of userIds) await auditLog(adminId, 'bulk_revoke_pro', id)
  revalidatePath('/users')
}

// ─── Communications ────────────────────────────────────────────────────────

export async function sendUserEmail(userId: string, subject: string, body: string) {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const {
    data: { user: authUser },
  } = await adminClient.auth.admin.getUserById(userId)
  const email = authUser?.email
  if (!email) return { error: 'No email found' }

  await adminClient.from('user_communications').insert({
    user_id: userId,
    type: 'email',
    subject,
    body,
    sent_by: adminId,
  })

  await adminClient.functions.invoke('send-email', { body: { to: email, subject, body } })
  await auditLog(adminId, 'send_email', userId)
  return {}
}

export async function sendUserPush(userId: string, message: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()

  await admin.from('notifications_log').insert({
    title: message,
    body: message,
    segment: userId,
    sent_at: new Date().toISOString(),
    open_count: 0,
  })

  await admin.from('user_communications').insert({
    user_id: userId,
    type: 'push',
    body: message,
    sent_by: adminId,
  })

  await auditLog(adminId, 'send_push', userId)
}

export async function getUserCommunications(userId: string): Promise<UserCommunication[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_communications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
  return (data ?? []) as UserCommunication[]
}

export async function getUserNotificationHistory(userId: string): Promise<NotificationLog[]> {
  assertUuid(userId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications_log')
    .select('*')
    .or(`segment.eq.${userId},segment.eq.all`)
    .order('sent_at', { ascending: false })
    .limit(20)
  return (data ?? []) as NotificationLog[]
}

// ─── Account management ────────────────────────────────────────────────────

export async function resetPassword(userId: string): Promise<{ error?: string }> {
  const adminId = await getAdminId()
  if (!adminId) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const {
    data: { user: authUser },
  } = await adminClient.auth.admin.getUserById(userId)
  const email = authUser?.email
  if (!email) return { error: 'No email found' }

  const { error } = await adminClient.auth.admin.generateLink({ type: 'recovery', email })
  if (error) return { error: error.message }

  await auditLog(adminId, 'reset_password', userId)
  return {}
}

export async function generateImpersonationLink(userId: string): Promise<string | null> {
  const adminId = await getAdminId()
  if (!adminId) return null

  const adminClient = createAdminClient()
  const {
    data: { user: authUser },
  } = await adminClient.auth.admin.getUserById(userId)
  const email = authUser?.email
  if (!email) return null

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (error) return null

  await auditLog(adminId, 'impersonate_user', userId)
  return data?.properties?.action_link ?? null
}

// ─── Moderation ────────────────────────────────────────────────────────────

export async function issueWarning(userId: string, reason: string, severity: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()

  await admin.from('user_warnings').insert({
    user_id: userId,
    reason,
    severity,
    issued_by: adminId,
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('warnings')
    .eq('id', userId)
    .single()
  await admin
    .from('profiles')
    .update({ warnings: (profile?.warnings ?? 0) + 1 })
    .eq('id', userId)

  await auditLog(adminId, `issue_warning:${severity}`, userId)
  revalidatePath('/users')
}

export async function getUserWarnings(userId: string): Promise<UserWarning[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_warnings')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })
  return (data ?? []) as UserWarning[]
}

export async function resolveWarning(warningId: string) {
  const admin = createAdminClient()
  await admin
    .from('user_warnings')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', warningId)
}

export async function setAppealStatus(userId: string, status: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ appeal_status: status }).eq('id', userId)
  await auditLog(adminId, `set_appeal_status:${status}`, userId)
  revalidatePath('/users')
}

// ─── Points & Progression ──────────────────────────────────────────────────

export async function adjustPoints(userId: string, amount: number, reason: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single()
  await admin
    .from('profiles')
    .update({ points: (profile?.points ?? 0) + amount })
    .eq('id', userId)

  await admin.from('points_history').insert({
    user_id: userId,
    amount,
    reason,
    admin_id: adminId,
  })

  await auditLog(adminId, `adjust_points:${amount > 0 ? '+' : ''}${amount}`, userId)
  revalidatePath('/users')
}

export async function getPointsHistory(userId: string): Promise<PointsHistoryEntry[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('points_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data ?? []) as PointsHistoryEntry[]
}

export async function resetStreak(userId: string, reason: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('profiles').update({ streak: 0 }).eq('id', userId)
  await auditLog(adminId, `reset_streak:${reason}`, userId)
  revalidatePath('/users')
}

export async function setStage(userId: string, stage: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  // Map stage name to bonsai_stage integer; also write stage text
  const stageMap: Record<string, number> = {
    'Seed': 1, 'Sprout': 2, 'Sapling': 3, 'Young Tree': 4,
    'Established': 5, 'Maturing': 6, 'Seasoned': 7, 'Ancient': 8,
  }
  void stageMap  // stageMap retained for future use
  await admin.from('profiles').update({ stage }).eq('id', userId)
  await auditLog(adminId, `set_stage:${stage}`, userId)
  revalidatePath('/users')
}

// ─── New drawer actions ─────────────────────────────────────────────────────

export async function deleteHabit(habitId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  const { data: habit } = await admin.from('habits').select('user_id').eq('id', habitId).single()
  await admin.from('habits').delete().eq('id', habitId)
  if (habit?.user_id) await auditLog(adminId, 'delete_habit', habit.user_id)
}

export async function addGoalNote(goalId: string, note: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('goal_notes').insert({ goal_id: goalId, note, admin_id: adminId })
}

export async function getGoalNotes(goalId: string): Promise<GoalNote[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('goal_notes')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
  return (data ?? []) as GoalNote[]
}

export async function setGardenerPhase(userId: string, phase: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('gardener_profiles').update({ phase }).eq('user_id', userId)
  await auditLog(adminId, `set_gardener_phase:${phase}`, userId)
}

export async function clearUserData(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await Promise.all([
    admin.from('habits').delete().eq('user_id', userId),
    admin.from('goals').delete().eq('user_id', userId),
    admin.from('daily_summaries').delete().eq('user_id', userId),
    admin.from('meal_suggestions').delete().eq('user_id', userId),
    admin.from('journal_entries').delete().eq('user_id', userId),
  ])
  await auditLog(adminId, 'clear_user_data', userId)
  revalidatePath('/users')
}

export async function anonymiseAccount(userId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const adminClient = createAdminClient()
  await adminClient.from('profiles').update({ full_name: 'Anonymous User', email: `anon_${userId.slice(0, 8)}@deleted.local` }).eq('id', userId)
  const anon = `anon_${userId.slice(0, 8)}@deleted.local`
  await adminClient.auth.admin.updateUserById(userId, { email: anon })
  await auditLog(adminId, 'anonymise_account', userId)
  revalidatePath('/users')
}

export async function saveAdminNote(userId: string, note: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('admin_notes').insert({ user_id: userId, note, admin_id: adminId })
}

export async function getAdminNotes(userId: string): Promise<(AdminNote & { admin_name: string | null })[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!data?.length) return []
  const adminIds = [...new Set(data.map(n => n.admin_id).filter(Boolean))] as string[]
  const { data: admins } = await admin.from('profiles').select('id, full_name, username').in('id', adminIds)
  const nameMap = new Map(admins?.map(a => [a.id, a.full_name ?? a.username]) ?? [])

  return data.map(n => ({ ...(n as AdminNote), admin_name: n.admin_id ? (nameMap.get(n.admin_id) ?? null) : null }))
}

export async function getHabitCompletionGrid(userId: string): Promise<{ date: string; count: number }[]> {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await admin
    .from('completions')
    .select('completed_at')
    .eq('user_id', userId)
    .gte('completed_at', thirtyDaysAgo.toISOString())

  const dateMap = new Map<string, number>()
  for (const c of data ?? []) {
    const date = (c.completed_at as string).slice(0, 10)
    dateMap.set(date, (dateMap.get(date) ?? 0) + 1)
  }
  return Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }))
}

export type HabitExtended = Habit & {
  totalCompletions: number
  completionRate30: number
  lastCompleted: string | null
  completionDates: string[]
}

export async function getUserHabitsExtended(userId: string): Promise<HabitExtended[]> {
  const admin = createAdminClient()
  const [{ data: habits }, { data: completions }] = await Promise.all([
    admin.from('habits').select('*').eq('user_id', userId),
    admin.from('completions').select('habit_id, completed_at').eq('user_id', userId),
  ])

  const compsByHabit = new Map<string, string[]>()
  for (const c of completions ?? []) {
    if (!c.habit_id) continue
    const arr = compsByHabit.get(c.habit_id) ?? []
    arr.push(c.completed_at as string)
    compsByHabit.set(c.habit_id, arr)
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  return (habits ?? []).map(h => {
    const dates = compsByHabit.get(h.id) ?? []
    const recent = dates.filter(d => new Date(d) >= thirtyDaysAgo)
    const sorted = dates.slice().sort()
    return {
      ...(h as Habit),
      totalCompletions: dates.length,
      completionRate30: Math.round((recent.length / 30) * 100),
      lastCompleted: sorted.length > 0 ? sorted[sorted.length - 1] : null,
      completionDates: dates.map(d => d.slice(0, 10)),
    }
  })
}

export type NutritionData = {
  macros: { calories: number; protein: number; carbs: number; fat: number }
  waterHitRate: number
  topFoods: { name: string; count: number }[]
  mealSuggestions: Array<{ id: string; meal_name: string | null; flagged: boolean | null; created_at: string }>
  bodyLogs: Array<{ weight: number | null; weight_unit: string | null; created_at: string }>
}

export async function getUserNutritionData(userId: string): Promise<NutritionData> {
  const admin = createAdminClient()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: foodLogs },
    { data: waterLogs },
    { data: mealSuggestions },
    { data: bodyLogs },
  ] = await Promise.all([
    admin.from('food_logs').select('calories, protein, carbohydrates, fat, food_name, date').eq('user_id', userId).gte('date', sevenDaysAgo.toISOString().slice(0, 10)),
    admin.from('water_logs').select('ml, goal_ml, date').eq('user_id', userId).gte('date', thirtyDaysAgo.toISOString().slice(0, 10)),
    admin.from('meal_suggestions').select('id, suggestion, flagged, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    admin.from('body_logs').select('weight, weight_unit, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ])

  const foods = foodLogs ?? []
  const calories = Math.round(foods.reduce((s, f) => s + ((f.calories as number | null) ?? 0), 0) / 7)
  const protein = Math.round(foods.reduce((s, f) => s + ((f.protein as number | null) ?? 0), 0) / 7)
  const carbs = Math.round(foods.reduce((s, f) => s + ((f.carbohydrates as number | null) ?? 0), 0) / 7)
  const fat = Math.round(foods.reduce((s, f) => s + ((f.fat as number | null) ?? 0), 0) / 7)

  const waterWithGoal = (waterLogs ?? []).filter(w => w.ml != null && w.goal_ml != null)
  const waterHit = waterWithGoal.filter(w => (w.ml ?? 0) >= (w.goal_ml ?? 9999)).length
  const waterHitRate = waterWithGoal.length ? Math.round((waterHit / waterWithGoal.length) * 100) : 0

  const foodCounts = new Map<string, number>()
  for (const f of foods) {
    const name = (f.food_name as string | null) ?? 'Unknown'
    foodCounts.set(name, (foodCounts.get(name) ?? 0) + 1)
  }
  const topFoods = Array.from(foodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return {
    macros: { calories, protein, carbs, fat },
    waterHitRate,
    topFoods,
    mealSuggestions: (mealSuggestions ?? []).map(m => ({ id: m.id, meal_name: m.suggestion ?? null, flagged: m.flagged ?? null, created_at: m.created_at })),
    bodyLogs: (bodyLogs ?? []).map(b => ({ weight: b.weight as number | null, weight_unit: (b as { weight_unit?: string | null }).weight_unit ?? null, created_at: b.created_at })),
  }
}

export type JournalData = {
  entries: Array<{ id: string; mood_score: number | null; content: string | null; flagged: boolean | null; created_at: string }>
  avgMood: number
  weekCounts: { week: string; count: number }[]
}

export async function getUserJournalData(userId: string): Promise<JournalData> {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: entries } = await admin
    .from('journal_entries')
    .select('id, mood_score, content, flagged, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const data = (entries ?? []) as JournalData['entries']
  const withMood = data.filter(e => e.mood_score != null)
  const avgMood = withMood.length > 0
    ? Math.round(withMood.reduce((s, e) => s + (e.mood_score ?? 0), 0) / withMood.length * 10) / 10
    : 0

  const weekMap = new Map<string, number>()
  for (const e of data) {
    const d = new Date(e.created_at)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    const key = d.toISOString().slice(0, 10)
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1)
  }

  const weekCounts = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }))

  return { entries: data, avgMood, weekCounts }
}

export async function unflagJournalEntry(entryId: string) {
  const admin = createAdminClient()
  await admin.from('journal_entries').update({ flagged: false }).eq('id', entryId)
}

export async function deleteJournalEntry(entryId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  const { data: entry } = await admin.from('journal_entries').select('user_id').eq('id', entryId).single()
  await admin.from('journal_entries').delete().eq('id', entryId)
  if (entry?.user_id) await auditLog(adminId, 'delete_journal_entry', entry.user_id)
}

export async function deleteGoal(goalId: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  const { data: goal } = await admin.from('goals').select('user_id').eq('id', goalId).single()
  await admin.from('goals').delete().eq('id', goalId)
  if (goal?.user_id) await auditLog(adminId, 'delete_goal', goal.user_id)
}

export async function getUserModerationHistory(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_audit_log')
    .select('*')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function getUserActivityFeed(userId: string) {
  const admin = createAdminClient()
  const [
    { data: completions },
    { data: goals },
    { data: points },
    { data: warnings },
  ] = await Promise.all([
    admin.from('completions').select('completed_at, habit_id').eq('user_id', userId).order('completed_at', { ascending: false }).limit(30),
    admin.from('goals').select('title, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    admin.from('points_history').select('amount, reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    admin.from('user_warnings').select('reason, issued_at').eq('user_id', userId).order('issued_at', { ascending: false }).limit(10),
  ])

  type ActivityEvent = { date: string; icon: string; label: string; type: string }
  const events: ActivityEvent[] = []

  for (const c of completions ?? []) {
    events.push({ date: c.completed_at as string, icon: '✓', label: 'Completed a habit', type: 'completion' })
  }
  for (const g of goals ?? []) {
    events.push({ date: g.created_at, icon: '◇', label: `Created goal: ${g.title}`, type: 'goal' })
  }
  for (const p of points ?? []) {
    events.push({ date: p.created_at, icon: '⭐', label: `${p.amount >= 0 ? '+' : ''}${p.amount} points — ${p.reason ?? ''}`, type: 'points' })
  }
  for (const w of warnings ?? []) {
    events.push({ date: w.issued_at, icon: '⚠', label: `Warning issued: ${w.reason}`, type: 'warning' })
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100)
}

export async function getGardenerProfile(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('gardener_profiles').select('*').eq('user_id', userId).single()
  return data
}
