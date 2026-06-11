'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'

type EventType =
  | 'signup'
  | 'habit_completed'
  | 'goal_created'
  | 'gardener_generated'
  | 'meal_suggested'
  | 'pro_started'

type FeedEvent = {
  key: string
  type: EventType
  user_name: string
  description: string
  timestamp: string
}

const EVENT_META: Record<EventType, { icon: string; color: string; label: string }> = {
  signup: { icon: '+', color: '#3fb950', label: 'New Signup' },
  habit_completed: { icon: '✓', color: '#39d0d8', label: 'Habit Completed' },
  goal_created: { icon: '◎', color: '#58a6ff', label: 'Goal Created' },
  gardener_generated: { icon: '⬡', color: '#bc8cff', label: 'Gardener Summary' },
  meal_suggested: { icon: '≡', color: '#d29922', label: 'Meal Suggested' },
  pro_started: { icon: '⬆', color: '#f85149', label: 'Pro Started' },
}

function fmt(ts: string) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' · ' +
    d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ActivityPage() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [liveCount, setLiveCount] = useState(0)
  const profileMapRef = useRef<Map<string, string>>(new Map())
  const habitMapRef = useRef<Map<string, string>>(new Map())

  const addEvent = useCallback((event: FeedEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 50))
    setLiveCount((n) => n + 1)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      type PRow = { id: string; full_name: string | null }
      type PRowFull = { id: string; full_name: string | null; created_at: string }
      type HRow = { id: string; name: string }
      type CRow = { id: string; user_id: string; habit_id: string | null; completed_at: string }
      type GRow = { id: string; user_id: string; title: string; created_at: string }
      type SRow = { id: string; user_id: string; created_at: string }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = (await (supabase.from('profiles').select('id, full_name') as any)) as { data: PRow[] | null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: habits } = (await (supabase.from('habits').select('id, name') as any)) as { data: HRow[] | null }
      ;(profiles ?? []).forEach((p) => profileMapRef.current.set(p.id, p.full_name ?? 'Unknown'))
      ;(habits ?? []).forEach((h) => habitMapRef.current.set(h.id, h.name))

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [sups, comps, goals, gardens, meals] = (await Promise.all([
        supabase.from('profiles').select('id, full_name, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        supabase.from('completions').select('id, user_id, habit_id, completed_at').gte('completed_at', since).order('completed_at', { ascending: false }).limit(20),
        supabase.from('goals').select('id, user_id, title, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        supabase.from('gardener_summaries').select('id, user_id, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        supabase.from('meal_suggestions').select('id, user_id, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
      ] as any[])) as [{ data: PRowFull[] | null }, { data: CRow[] | null }, { data: GRow[] | null }, { data: SRow[] | null }, { data: SRow[] | null }]

      const initial: FeedEvent[] = [
        ...(sups.data ?? []).map((p) => ({
          key: `signup-${p.id}`,
          type: 'signup' as EventType,
          user_name: p.full_name ?? 'Unknown',
          description: 'signed up',
          timestamp: p.created_at,
        })),
        ...(comps.data ?? []).map((c) => ({
          key: `habit-${c.id}`,
          type: 'habit_completed' as EventType,
          user_name: profileMapRef.current.get(c.user_id) ?? 'Unknown',
          description: `completed "${habitMapRef.current.get(c.habit_id ?? '') ?? 'a habit'}"`,
          timestamp: c.completed_at,
        })),
        ...(goals.data ?? []).map((g) => ({
          key: `goal-${g.id}`,
          type: 'goal_created' as EventType,
          user_name: profileMapRef.current.get(g.user_id) ?? 'Unknown',
          description: `created goal "${g.title}"`,
          timestamp: g.created_at,
        })),
        ...(gardens.data ?? []).map((s) => ({
          key: `gardener-${s.id}`,
          type: 'gardener_generated' as EventType,
          user_name: profileMapRef.current.get(s.user_id) ?? 'Unknown',
          description: 'received a Gardener summary',
          timestamp: s.created_at,
        })),
        ...(meals.data ?? []).map((m) => ({
          key: `meal-${m.id}`,
          type: 'meal_suggested' as EventType,
          user_name: profileMapRef.current.get(m.user_id) ?? 'Unknown',
          description: 'received a meal suggestion',
          timestamp: m.created_at,
        })),
      ]

      initial.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(initial.slice(0, 50))
      setLoading(false)
    }

    init()

    const channel = supabase
      .channel('admin-activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as { id: string; full_name: string | null; plan: string | null; created_at: string }
        profileMapRef.current.set(p.id, p.full_name ?? 'Unknown')
        addEvent({
          key: `signup-${p.id}-${Date.now()}`,
          type: 'signup',
          user_name: p.full_name ?? 'Unknown',
          description: 'signed up',
          timestamp: p.created_at ?? new Date().toISOString(),
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as { id: string; full_name: string | null; plan: string | null }
        if (p.plan === 'pro') {
          addEvent({
            key: `pro-${p.id}-${Date.now()}`,
            type: 'pro_started',
            user_name: profileMapRef.current.get(p.id) ?? p.full_name ?? 'Unknown',
            description: 'started a Pro subscription',
            timestamp: new Date().toISOString(),
          })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'completions' }, (payload) => {
        const c = payload.new as { id: string; user_id: string; habit_id: string; completed_at: string }
        addEvent({
          key: `habit-${c.id}-${Date.now()}`,
          type: 'habit_completed',
          user_name: profileMapRef.current.get(c.user_id) ?? 'Unknown',
          description: `completed "${habitMapRef.current.get(c.habit_id ?? '') ?? 'a habit'}"`,
          timestamp: c.completed_at ?? new Date().toISOString(),
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals' }, (payload) => {
        const g = payload.new as { id: string; user_id: string; title: string; created_at: string }
        addEvent({
          key: `goal-${g.id}-${Date.now()}`,
          type: 'goal_created',
          user_name: profileMapRef.current.get(g.user_id) ?? 'Unknown',
          description: `created goal "${g.title}"`,
          timestamp: g.created_at ?? new Date().toISOString(),
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gardener_summaries' }, (payload) => {
        const s = payload.new as { id: string; user_id: string; created_at: string }
        addEvent({
          key: `gardener-${s.id}-${Date.now()}`,
          type: 'gardener_generated',
          user_name: profileMapRef.current.get(s.user_id) ?? 'Unknown',
          description: 'received a Gardener summary',
          timestamp: s.created_at ?? new Date().toISOString(),
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meal_suggestions' }, (payload) => {
        const m = payload.new as { id: string; user_id: string; created_at: string }
        addEvent({
          key: `meal-${m.id}-${Date.now()}`,
          type: 'meal_suggested',
          user_name: profileMapRef.current.get(m.user_id) ?? 'Unknown',
          description: 'received a meal suggestion',
          timestamp: m.created_at ?? new Date().toISOString(),
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [addEvent])

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={loading ? 'Loading…' : `Showing ${events.length} events · ${liveCount} live`}
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#3fb950', boxShadow: '0 0 6px #3fb950' }} />
          <span className="text-xs" style={{ color: '#3fb950' }}>Live</span>
        </div>
        <button
          onClick={() => { setEvents([]); setLiveCount(0) }}
          className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
          style={{
            background: 'transparent',
            color: '#7d8fa3',
            border: '1px solid #1a2332',
          }}
        >
          Clear Feed
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm" style={{ color: '#7d8fa3' }}>Loading activity…</p>
        </div>
      ) : events.length === 0 ? (
        <div
          className="rounded-lg p-12 text-center"
          style={{ background: '#0d1117', border: '1px solid #1a2332' }}
        >
          <p className="text-sm" style={{ color: '#7d8fa3' }}>No activity in the last 7 days</p>
        </div>
      ) : (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-[19px]"
            style={{ width: 1, background: '#1a2332' }}
          />
          <div className="flex flex-col gap-0">
            {events.map((event, i) => {
              const meta = EVENT_META[event.type]
              return (
                <div key={event.key} className="flex gap-4 relative">
                  <div
                    className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold z-10"
                    style={{
                      background: `${meta.color}22`,
                      border: `1px solid ${meta.color}44`,
                      color: meta.color,
                      marginTop: i === 0 ? 0 : 0,
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div
                    className="flex-1 rounded-lg px-4 py-3 mb-2"
                    style={{ background: '#0d1117', border: '1px solid #1a2332' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{ color: meta.color, background: `${meta.color}22`, border: `1px solid ${meta.color}44` }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                          {event.user_name}
                        </span>
                        <span className="text-sm" style={{ color: '#7d8fa3' }}>
                          {event.description}
                        </span>
                      </div>
                      <span className="text-xs whitespace-nowrap shrink-0" style={{ color: '#7d8fa3' }}>
                        {fmt(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
