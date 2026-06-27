'use server'

import { genericAdmin } from '@/lib/supabase/generic'
import { requireAdmin } from './_admin'
import type { Row } from './resources'

export interface MasteryStats {
  pillars: number
  topics: number
  tasks: number
  sessions: number
  messages: number
  insights: number
  activeUsers: number
}

export async function getMasteryStats(): Promise<MasteryStats> {
  await requireAdmin()
  const admin = genericAdmin()
  const head = async (t: string) => {
    const { count } = await admin.from(t).select('*', { count: 'exact', head: true })
    return count ?? 0
  }
  const [pillars, topics, tasks, sessions, messages, insights, sessRows] = await Promise.all([
    head('mastery_pillars'), head('mastery_topics'), head('mastery_tasks'),
    head('mastery_sessions'), head('mastery_messages'), head('mastery_insights'),
    admin.from('mastery_sessions').select('user_id').limit(5000),
  ])
  const users = new Set(((sessRows.data ?? []) as Row[]).map((r) => r.user_id as string).filter(Boolean))
  return { pillars, topics, tasks, sessions, messages, insights, activeUsers: users.size }
}

export interface MasteryUserRow {
  user_id: string
  label: string
  topics: number
  sessions: number
  insights: number
  lastActivity: string | null
}

export async function listMasteryUsers(): Promise<MasteryUserRow[]> {
  await requireAdmin()
  const admin = genericAdmin()
  const [topics, sessions, insights] = await Promise.all([
    admin.from('mastery_topics').select('user_id').limit(10000),
    admin.from('mastery_sessions').select('user_id, started_at').limit(10000),
    admin.from('mastery_insights').select('user_id').limit(10000),
  ])
  const map = new Map<string, { topics: number; sessions: number; insights: number; last: string | null }>()
  const bump = (uid: string | null, key: 'topics' | 'sessions' | 'insights', when?: string | null) => {
    if (!uid) return
    const e = map.get(uid) ?? { topics: 0, sessions: 0, insights: 0, last: null }
    e[key]++
    if (when && (!e.last || when > e.last)) e.last = when
    map.set(uid, e)
  }
  for (const r of (topics.data ?? []) as Row[]) bump(r.user_id as string, 'topics')
  for (const r of (sessions.data ?? []) as Row[]) bump(r.user_id as string, 'sessions', r.started_at as string)
  for (const r of (insights.data ?? []) as Row[]) bump(r.user_id as string, 'insights')

  const ids = [...map.keys()]
  const labels = new Map<string, string>()
  if (ids.length) {
    const { data } = await admin.from('profiles').select('id, display_name, email').in('id', ids)
    for (const p of (data ?? []) as Row[]) labels.set(p.id as string, (p.display_name as string) || (p.email as string) || (p.id as string))
  }
  return [...map.entries()]
    .map(([user_id, e]) => ({ user_id, label: labels.get(user_id) ?? user_id, topics: e.topics, sessions: e.sessions, insights: e.insights, lastActivity: e.last }))
    .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))
}

export interface UserMastery {
  topics: Row[]
  tasks: Row[]
  sessions: Row[]
  insights: Row[]
  pillarNames: Record<string, string>
}

export async function getUserMastery(userId: string): Promise<UserMastery> {
  await requireAdmin()
  const admin = genericAdmin()
  const [topics, tasks, sessions, insights, pillars] = await Promise.all([
    admin.from('mastery_topics').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('mastery_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('mastery_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    admin.from('mastery_insights').select('*').eq('user_id', userId).order('surfaced_at', { ascending: false }),
    admin.from('mastery_pillars').select('id, name'),
  ])
  const pillarNames: Record<string, string> = {}
  for (const p of (pillars.data ?? []) as Row[]) pillarNames[p.id as string] = p.name as string
  return {
    topics: (topics.data ?? []) as Row[],
    tasks: (tasks.data ?? []) as Row[],
    sessions: (sessions.data ?? []) as Row[],
    insights: (insights.data ?? []) as Row[],
    pillarNames,
  }
}

export async function getSessionMessages(sessionId: string): Promise<Row[]> {
  await requireAdmin()
  const admin = genericAdmin()
  const { data } = await admin.from('mastery_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
  return (data ?? []) as Row[]
}
