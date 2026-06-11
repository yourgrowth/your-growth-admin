'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  ONBOARDING_STEPS,
  type StepStat,
  type DroppedUser,
  type TimeStatRow,
  type CohortWeek,
} from './onboarding-constants'

export async function getStepStats(): Promise<StepStat[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('onboarding_events')
    .select('step, user_id, completed, time_spent_seconds')

  const events = data ?? []

  return ONBOARDING_STEPS.map(step => {
    const stepEvents = events.filter(e => e.step === step)
    const reached = new Set(stepEvents.map(e => e.user_id)).size
    const completedCount = stepEvents.filter(e => e.completed).length
    const timesWithData = stepEvents.filter(e => e.time_spent_seconds != null)
    const avgTimeSeconds = timesWithData.length > 0
      ? Math.round(timesWithData.reduce((s, e) => s + (e.time_spent_seconds ?? 0), 0) / timesWithData.length)
      : 0
    return { step, reached, completedCount, avgTimeSeconds }
  })
}

export async function getUsersAtStep(step: string): Promise<DroppedUser[]> {
  const admin = createAdminClient()
  const stepIndex = ONBOARDING_STEPS.indexOf(step)
  const nextStep = stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[stepIndex + 1] : null

  const { data: reachedEvents } = await admin
    .from('onboarding_events')
    .select('user_id')
    .eq('step', step)

  const reachedIds = [...new Set(reachedEvents?.map(e => e.user_id).filter(Boolean) as string[])]
  if (!reachedIds.length) return []

  let completedIds = new Set<string>()
  if (nextStep) {
    const { data: nextEvents } = await admin
      .from('onboarding_events')
      .select('user_id')
      .eq('step', nextStep)
      .in('user_id', reachedIds)
    completedIds = new Set(nextEvents?.map(e => e.user_id).filter(Boolean) as string[])
  }

  const droppedIds = reachedIds.filter(id => !completedIds.has(id))
  if (!droppedIds.length) return []

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, username, email, plan, created_at')
    .in('id', droppedIds)

  return (profiles ?? []).map(p => ({
    id: p.id,
    display_name: p.full_name ?? p.username,
    email: p.email,
    subscription_status: p.plan,
    created_at: p.created_at,
  }))
}

export async function sendReengagement(userId: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('notifications_log') as any).insert({
    title: 'Complete your onboarding',
    body: 'Come back and finish setting up your Bonsai app!',
    segment: userId,
    sent_at: new Date().toISOString(),
    open_count: 0,
  })
}

export async function getStepTimeStats(): Promise<TimeStatRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('onboarding_events')
    .select('step, time_spent_seconds')
    .not('time_spent_seconds', 'is', null)

  const byStep = new Map<string, number[]>()
  for (const e of data ?? []) {
    const arr = byStep.get(e.step) ?? []
    arr.push(e.time_spent_seconds!)
    byStep.set(e.step, arr)
  }

  return ONBOARDING_STEPS.map(step => {
    const times = byStep.get(step) ?? []
    const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
    return { step, avgSeconds: avg }
  })
}

export async function getWeekCohorts(): Promise<CohortWeek[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, created_at')
    .order('created_at', { ascending: false })

  const weekMap = new Map<string, string[]>()
  for (const p of data ?? []) {
    const d = new Date(p.created_at)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    const key = d.toISOString().slice(0, 10)
    const arr = weekMap.get(key) ?? []
    arr.push(p.id)
    weekMap.set(key, arr)
  }

  return Array.from(weekMap.entries())
    .map(([week, userIds]) => ({
      week,
      label: `Week of ${new Date(week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      userIds,
    }))
    .slice(0, 12)
}

export async function getStepStatsForCohort(userIds: string[]): Promise<StepStat[]> {
  if (!userIds.length) return ONBOARDING_STEPS.map(step => ({ step, reached: 0, completedCount: 0, avgTimeSeconds: 0 }))
  const admin = createAdminClient()
  const { data } = await admin
    .from('onboarding_events')
    .select('step, user_id, completed, time_spent_seconds')
    .in('user_id', userIds)

  const events = data ?? []
  return ONBOARDING_STEPS.map(step => {
    const stepEvents = events.filter(e => e.step === step)
    const reached = new Set(stepEvents.map(e => e.user_id)).size
    const completedCount = stepEvents.filter(e => e.completed).length
    const timesWithData = stepEvents.filter(e => e.time_spent_seconds != null)
    const avgTimeSeconds = timesWithData.length > 0
      ? Math.round(timesWithData.reduce((s, e) => s + (e.time_spent_seconds ?? 0), 0) / timesWithData.length)
      : 0
    return { step, reached, completedCount, avgTimeSeconds }
  })
}
