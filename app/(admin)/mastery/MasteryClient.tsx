'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  C, Card, Tabs, Pill, Input, Modal, EmptyState, ToastProvider, relativeTime,
} from '@/components/admin/kit'
import ResourceManager from '@/components/admin/ResourceManager'
import type { ResourceConfig } from '@/lib/admin/resources'
import type { ListResult, Row } from '@/app/actions/resources'
import {
  type MasteryStats, type MasteryUserRow, type UserMastery,
  getUserMastery, getSessionMessages,
} from '@/app/actions/mastery'

type Tab = 'overview' | 'pillars' | 'users' | 'raw'

const RAW_TABLES: { table: string; label: string }[] = [
  { table: 'mastery_topics', label: 'Topics' },
  { table: 'mastery_tasks', label: 'Tasks' },
  { table: 'mastery_sessions', label: 'Sessions' },
  { table: 'mastery_messages', label: 'Messages' },
  { table: 'mastery_insights', label: 'Insights' },
  { table: 'mastery_daily_dump', label: 'Daily Dump' },
]

export default function MasteryClient({ stats, users, pillarsConfig, pillarsInitial }: {
  stats: MasteryStats; users: MasteryUserRow[]; pillarsConfig: ResourceConfig; pillarsInitial: ListResult
}) {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <ToastProvider>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text }}>Mastering Yourself</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
          Author the pillar content the founder writes, and explore every user&apos;s reflection sessions, insights and tasks.
        </p>
      </div>

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'pillars', label: 'Pillars (CMS)' },
          { key: 'users', label: 'Explore by user' },
          { key: 'raw', label: 'Raw tables' },
        ]}
      />

      {tab === 'overview' && <Overview stats={stats} />}
      {tab === 'pillars' && <ResourceManager config={pillarsConfig} initial={pillarsInitial} />}
      {tab === 'users' && <UsersExplorer users={users} />}
      {tab === 'raw' && <RawTables />}
    </ToastProvider>
  )
}

function Stat({ label, value, color = C.green }: { label: string; value: number; color?: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, marginTop: 4 }}>{value.toLocaleString()}</p>
    </Card>
  )
}

function Overview({ stats }: { stats: MasteryStats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      <Stat label="Pillars" value={stats.pillars} />
      <Stat label="Active users" value={stats.activeUsers} color={C.cyan} />
      <Stat label="Topics" value={stats.topics} color={C.blue} />
      <Stat label="Sessions" value={stats.sessions} color={C.purple} />
      <Stat label="Messages" value={stats.messages} color={C.purple} />
      <Stat label="Insights" value={stats.insights} color={C.amber} />
      <Stat label="Tasks" value={stats.tasks} color={C.green} />
    </div>
  )
}

function RawTables() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {RAW_TABLES.map((t) => (
        <Link key={t.table} href={`/data/${t.table}`} style={{ textDecoration: 'none' }}>
          <Card style={{ padding: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t.label}</p>
            <p style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Full CRUD grid → {t.table}</p>
          </Card>
        </Link>
      ))}
    </div>
  )
}

// --- user explorer ----------------------------------------------------------
function UsersExplorer({ users }: { users: MasteryUserRow[] }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState<MasteryUserRow | null>(null)
  const filtered = q.trim() ? users.filter((u) => u.label.toLowerCase().includes(q.toLowerCase())) : users

  if (active) return <UserDetail user={active} onBack={() => setActive(null)} />

  return (
    <div>
      <Input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: 14 }} />
      {filtered.length === 0 ? (
        <EmptyState title="No mastery activity yet" hint="Users appear here once they start a reflection." />
      ) : (
        <div style={{ border: `1px solid ${C.dim}`, borderRadius: 10, overflow: 'hidden' }}>
          {filtered.map((u, i) => (
            <button
              key={u.user_id}
              onClick={() => setActive(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                background: C.bg, border: 'none', borderTop: i ? `1px solid ${C.dim}` : 'none',
                padding: '12px 16px', cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.text }}>{u.label}</span>
              <Pill color={C.blue}>{u.topics} topics</Pill>
              <Pill color={C.purple}>{u.sessions} sessions</Pill>
              <Pill color={C.amber}>{u.insights} insights</Pill>
              <span style={{ fontSize: 11.5, color: C.muted, minWidth: 70, textAlign: 'right' }}>{relativeTime(u.lastActivity)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserDetail({ user, onBack }: { user: MasteryUserRow; onBack: () => void }) {
  const [data, setData] = useState<UserMastery | null>(null)
  const [session, setSession] = useState<Row | null>(null)
  const [messages, setMessages] = useState<Row[]>([])

  useEffect(() => {
    let live = true
    getUserMastery(user.user_id).then((d) => { if (live) setData(d) })
    return () => { live = false }
  }, [user.user_id])

  async function openSession(s: Row) {
    setSession(s)
    setMessages(await getSessionMessages(s.id as string))
  }

  const pillarName = (id: unknown) => (id ? data?.pillarNames[id as string] ?? '—' : '—')

  return (
    <div>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12.5, marginBottom: 14 }}>← All users</button>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16 }}>{user.label}</h2>

      {!data ? (
        <EmptyState title="Loading…" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section title={`Topics (${data.topics.length})`}>
            {data.topics.map((t) => (
              <Card key={t.id as string} style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, flex: 1 }}>{t.title as string}</span>
                  <Pill color={t.status === 'mastered' ? C.green : C.blue}>{t.status as string}</Pill>
                  <Pill color={C.muted2}>{pillarName(t.pillar_id)}</Pill>
                </div>
                {t.summary ? <p style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{t.summary as string}</p> : null}
              </Card>
            ))}
            {data.topics.length === 0 && <Muted>No topics.</Muted>}
          </Section>

          <Section title={`Sessions (${data.sessions.length})`}>
            {data.sessions.map((s) => (
              <button key={s.id as string} onClick={() => openSession(s)} style={{ textAlign: 'left', background: C.bg, border: `1px solid ${C.dim}`, borderRadius: 8, padding: 12, cursor: 'pointer', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Pill color={C.muted2}>{pillarName(s.pillar_id)}</Pill>
                  <span style={{ fontSize: 11.5, color: C.muted }}>depth {String(s.depth_reached ?? 0)}</span>
                  {s.end_reason ? <Pill color={C.purple}>{s.end_reason as string}</Pill> : null}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: C.muted }}>{relativeTime(s.started_at as string)}</span>
                </div>
                {s.key_insight ? <p style={{ fontSize: 12.5, color: C.text, marginTop: 6, fontStyle: 'italic' }}>“{s.key_insight as string}”</p> : null}
              </button>
            ))}
            {data.sessions.length === 0 && <Muted>No sessions.</Muted>}
          </Section>

          <Section title={`Insights (${data.insights.length})`}>
            {data.insights.map((ins) => (
              <Card key={ins.id as string} style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Pill color={C.amber}>{ins.kind as string}</Pill>
                  {ins.resolved ? <Pill color={C.green}>resolved</Pill> : null}
                  <Pill color={C.muted2}>{pillarName(ins.pillar_id)}</Pill>
                </div>
                <p style={{ fontSize: 13, color: C.text }}>{ins.content as string}</p>
              </Card>
            ))}
            {data.insights.length === 0 && <Muted>No insights.</Muted>}
          </Section>

          <Section title={`Tasks (${data.tasks.length})`}>
            {data.tasks.map((t) => (
              <Card key={t.id as string} style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{t.body as string}</span>
                  <Pill color={t.status === 'done' ? C.green : t.status === 'dropped' ? C.red : C.blue}>{t.status as string}</Pill>
                  <Pill color={C.muted2}>{t.kind as string}</Pill>
                </div>
              </Card>
            ))}
            {data.tasks.length === 0 && <Muted>No tasks.</Muted>}
          </Section>
        </div>
      )}

      <Modal open={!!session} onClose={() => setSession(null)} title="Session transcript" width={680}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 ? <Muted>No messages.</Muted> : messages.map((m) => (
            <div key={m.id as string} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <div style={{
                background: m.role === 'user' ? C.dim2 : `${C.green}18`,
                border: `1px solid ${m.role === 'user' ? C.dim2 : C.green}44`,
                borderRadius: 10, padding: '9px 12px',
              }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: m.role === 'user' ? C.muted : C.green }}>{m.role as string}</span>
                  {m.crisis_flagged ? <Pill color={C.red}>crisis</Pill> : null}
                </div>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content as string}</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted, marginBottom: 10 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: C.muted2 }}>{children}</p>
}
