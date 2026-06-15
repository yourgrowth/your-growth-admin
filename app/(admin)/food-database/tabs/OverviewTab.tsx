'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOverviewStats, getScraperRuns, logScraperRun, type OverviewStats } from '@/app/actions/foodDatabase'
import type { ScraperRun } from '@/types/database'
import {
  C, Card, SectionTitle, Pill, Button, Input, Select, Modal, useToast,
  sourceColor, sourceLabel, relativeTime, EmptyState,
} from '../_ui'

const REFRESH_KEY = 'fdb_refresh_interval'

type FeedEvent = { id: string; type: 'INSERT' | 'UPDATE'; name: string | null; brand: string | null; barcode: string | null; source: string | null; at: number }

function Stat({ label, value, sub, color = C.text }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</p>}
    </Card>
  )
}

export default function OverviewTab({ initialStats, initialRuns }: { initialStats: OverviewStats; initialRuns: ScraperRun[] }) {
  const [stats, setStats] = useState(initialStats)
  const [runs, setRuns] = useState(initialRuns)
  const [refreshing, setRefreshing] = useState(false)
  const [interval, setIntervalMs] = useState(30000)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null
    if (saved) setIntervalMs(Number(saved))
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [s, r] = await Promise.all([getOverviewStats(), getScraperRuns(10)])
      setStats(s); setRuns(r)
    } catch { /* ignore */ }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (interval <= 0) return
    const t = setInterval(() => { getOverviewStats().then(setStats).catch(() => {}) }, interval)
    return () => clearInterval(t)
  }, [interval])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Stats bar */}
      <div>
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</Button>}>
          Database statistics
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          <Stat label="Total products" value={stats.total.toLocaleString()} color={C.green} />
          <Stat label="Published" value={stats.published.toLocaleString()} sub={`${stats.unpublished.toLocaleString()} unpublished`} color={C.blue} />
          <Stat label="Macro coverage" value={`${stats.macroCompletePct}%`} sub={`${stats.missingMacros.toLocaleString()} missing macros`} color={stats.macroCompletePct >= 80 ? C.green : C.amber} />
          <Stat label="Has image" value={`${stats.hasImagePct}%`} sub={`${stats.hasImage.toLocaleString()} with image`} color={C.purple} />
          <Stat label="Additive analyses" value={stats.additiveAnalyses.toLocaleString()} sub="product_analyses" color={C.cyan} />
          <Stat label="Nutrition cache" value={stats.nutritionCacheEntries.toLocaleString()} sub="cached profiles" color={C.amber} />
          <Stat label="Last product added" value={relativeTime(stats.lastAddedAt)} />
        </div>
        {stats.sources.length > 0 && (
          <Card style={{ marginTop: 12, padding: 14 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 10 }}>Source breakdown</p>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {stats.sources.map((s) => (
                <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: sourceColor(s.source) }} />
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{sourceLabel(s.source)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{s.count.toLocaleString()} · {s.pct}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <LiveFeed />

      <ScraperHistory runs={runs} onLogged={refresh} />

      {/* hidden interval reader kept in sync with Settings tab */}
      <span style={{ display: 'none' }} data-interval={interval} />
    </div>
  )
}

function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [bufferedCount, setBufferedCount] = useState(0)
  const [lastEventAt, setLastEventAt] = useState<number>(Date.now())
  const [connected, setConnected] = useState(false)
  const pausedRef = useRef(paused)
  const bufferRef = useRef<FeedEvent[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const atTopRef = useRef(true)
  const [, force] = useState(0)

  pausedRef.current = paused

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('foods-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'foods' }, (payload) => handle('INSERT', payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'foods' }, (payload) => handle('UPDATE', payload.new))
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    function handle(type: 'INSERT' | 'UPDATE', row: Record<string, unknown>) {
      const ev: FeedEvent = {
        id: `${row.id}-${Date.now()}-${Math.random()}`,
        type,
        name: (row.name as string) ?? null,
        brand: (row.brand as string) ?? null,
        barcode: (row.barcode as string) ?? null,
        source: (row.source as string) ?? null,
        at: Date.now(),
      }
      setLastEventAt(Date.now())
      if (pausedRef.current) {
        bufferRef.current = [ev, ...bufferRef.current].slice(0, 100)
        setBufferedCount(bufferRef.current.length)
      } else {
        setEvents((prev) => [ev, ...prev].slice(0, 100))
      }
    }

    return () => { supabase.removeChannel(channel) }
  }, [])

  // re-render the "idle" indicator periodically
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  // auto-scroll to top on new events unless the user scrolled down
  useEffect(() => {
    if (!paused && atTopRef.current && scrollRef.current) scrollRef.current.scrollTop = 0
  }, [events, paused])

  const resume = () => {
    setEvents((prev) => [...bufferRef.current, ...prev].slice(0, 100))
    bufferRef.current = []
    setBufferedCount(0)
    setPaused(false)
  }

  const idle = Date.now() - lastEventAt > 60000

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted }}>Live scraper feed</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {connected && !idle && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: C.green, letterSpacing: '0.05em' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, animation: 'fdPulse 1.4s infinite' }} />LIVE
            </span>
          )}
          {idle && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.muted2 }} />IDLE
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => (paused ? resume() : setPaused(true))}>{paused ? `Resume${bufferedCount ? ` (${bufferedCount})` : ''}` : 'Pause'}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEvents([]); bufferRef.current = []; setBufferedCount(0) }}>Clear feed</Button>
        </div>
      </div>

      {paused && bufferedCount > 0 && (
        <div style={{ fontSize: 12, color: C.amber, marginBottom: 8 }}>{bufferedCount} new event{bufferedCount === 1 ? '' : 's'} while paused</div>
      )}

      <div
        ref={scrollRef}
        onScroll={(e) => { atTopRef.current = (e.target as HTMLDivElement).scrollTop < 24 }}
        style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {events.length === 0 && (
          <EmptyState title={idle ? 'Scraper idle' : 'Waiting for events…'} hint="New products and updates will appear here in real time." />
        )}
        {events.map((ev) => (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: `1px solid ${C.dim}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ev.type === 'INSERT' ? C.green : C.amber }} />
            <Pill color={sourceColor(ev.source)}>{sourceLabel(ev.source)}</Pill>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ev.name ?? '(no name)'}{ev.brand ? <span style={{ color: C.muted, fontWeight: 400 }}> · {ev.brand}</span> : null}
            </span>
            <span style={{ fontSize: 11, color: C.muted2, fontFamily: 'monospace' }}>{ev.barcode ?? '—'}</span>
            <span style={{ fontSize: 11, color: C.muted, width: 64, textAlign: 'right' }}>{relativeTime(new Date(ev.at).toISOString())}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ScraperHistory({ runs, onLogged }: { runs: ScraperRun[]; onLogged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState({ source: 'all', status: 'completed', products_scraped: '', off_hits: '', ollama_hits: '', misses: '', errors: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const visible = showAll ? runs : runs.slice(0, 10)

  const statusPill = (s: string | null) => {
    if (s === 'running') return <Pill color={C.blue}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.blue, animation: 'fdPulse 1.4s infinite' }} />Running</Pill>
    if (s === 'failed') return <Pill color={C.red}>Failed</Pill>
    return <Pill color={C.green}>Completed</Pill>
  }

  const duration = (r: ScraperRun) => {
    if (!r.completed_at) return '—'
    const ms = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()
    if (ms < 0) return '—'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const submit = async () => {
    setSaving(true)
    const res = await logScraperRun({
      source: form.source, status: form.status,
      products_scraped: Number(form.products_scraped) || 0,
      off_hits: Number(form.off_hits) || 0,
      ollama_hits: Number(form.ollama_hits) || 0,
      misses: Number(form.misses) || 0,
      errors: Number(form.errors) || 0,
      notes: form.notes || null,
    })
    setSaving(false)
    if (res.ok) { toast('Run logged'); setOpen(false); setForm({ source: 'all', status: 'completed', products_scraped: '', off_hits: '', ollama_hits: '', misses: '', errors: '', notes: '' }); onLogged() }
    else toast(res.error ?? 'Failed to log run', 'error')
  }

  const cols = ['Started', 'Duration', 'Status', 'Products', 'OFF', 'Ollama', 'Misses', 'Errors', 'Source', 'Notes']

  return (
    <Card>
      <SectionTitle action={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>Log New Run</Button>}>Scraper run history</SectionTitle>
      {runs.length === 0 ? (
        <EmptyState title="No scraper runs logged yet" hint="Log a run manually after triggering the scraper locally." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.dim}` }}>
                {cols.map((c) => <th key={c} style={{ textAlign: 'left', padding: '8px 10px', color: C.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: '8px 10px', color: C.text, whiteSpace: 'nowrap' }}>{new Date(r.started_at).toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', color: C.muted }}>{duration(r)}</td>
                  <td style={{ padding: '8px 10px' }}>{statusPill(r.status)}</td>
                  <td style={{ padding: '8px 10px', color: C.text }}>{r.products_scraped ?? 0}</td>
                  <td style={{ padding: '8px 10px', color: C.blue }}>{r.off_hits ?? 0}</td>
                  <td style={{ padding: '8px 10px', color: C.purple }}>{r.ollama_hits ?? 0}</td>
                  <td style={{ padding: '8px 10px', color: C.muted }}>{r.misses ?? 0}</td>
                  <td style={{ padding: '8px 10px', color: (r.errors ?? 0) > 0 ? C.red : C.muted }}>{r.errors ?? 0}</td>
                  <td style={{ padding: '8px 10px', color: C.text }}>{sourceLabel(r.source)}</td>
                  <td style={{ padding: '8px 10px', color: C.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length > 10 && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show less' : 'See all runs'}</Button>
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Log scraper run">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Source"><Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={{ width: '100%' }}><option value="all">All</option><option value="woolworths">Woolworths</option><option value="coles">Coles</option></Select></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ width: '100%' }}><option value="completed">Completed</option><option value="running">Running</option><option value="failed">Failed</option></Select></Field>
          <Field label="Products scraped"><Input type="number" value={form.products_scraped} onChange={(e) => setForm({ ...form, products_scraped: e.target.value })} /></Field>
          <Field label="OFF hits"><Input type="number" value={form.off_hits} onChange={(e) => setForm({ ...form, off_hits: e.target.value })} /></Field>
          <Field label="Ollama hits"><Input type="number" value={form.ollama_hits} onChange={(e) => setForm({ ...form, ollama_hits: e.target.value })} /></Field>
          <Field label="Misses"><Input type="number" value={form.misses} onChange={(e) => setForm({ ...form, misses: e.target.value })} /></Field>
          <Field label="Errors"><Input type="number" value={form.errors} onChange={(e) => setForm({ ...form, errors: e.target.value })} /></Field>
          <div />
          <div style={{ gridColumn: '1 / -1' }}><Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></Field></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log run'}</Button>
        </div>
      </Modal>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}
