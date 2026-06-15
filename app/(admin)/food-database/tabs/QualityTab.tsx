'use client'

import { useEffect, useState } from 'react'
import {
  getCoverage, getDuplicates, getOutliers, appSearchPreview, bulkFlag, resolveDuplicateKeep, mergeDuplicates,
  type CoverageRow, type DuplicateGroup, type OutlierRow,
} from '@/app/actions/foodDatabase'
import type { Food } from '@/types/database'
import { C, Card, SectionTitle, Button, Input, Modal, Pill, useToast, Skeleton, EmptyState, sourceColor, sourceLabel, coverColor } from '../_ui'

export default function QualityTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <CoverageHeatmap />
      <DuplicateDetector />
      <OutlierDetection />
      <MissingBreakdown />
      <AppSearchPreview />
    </div>
  )
}

function CoverageHeatmap() {
  const [rows, setRows] = useState<CoverageRow[] | null>(null)
  const load = () => { setRows(null); getCoverage().then(setRows).catch(() => setRows([])) }
  useEffect(load, [])
  return (
    <Card>
      <SectionTitle action={<Button size="sm" variant="ghost" onClick={load}>↻ Refresh</Button>}>Coverage heatmap</SectionTitle>
      {!rows ? <Skeleton height={120} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {rows.map((r) => {
            const col = r.pct >= 90 ? C.green : r.pct >= 60 ? C.amber : C.red
            return (
              <div key={r.field} style={{ borderRadius: 8, padding: 12, background: `${col}1a`, border: `1px solid ${col}44` }}>
                <p style={{ fontSize: 11.5, color: C.text, fontWeight: 600, marginBottom: 4 }}>{r.field}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: col }}>{r.pct}%</p>
                <p style={{ fontSize: 10.5, color: C.muted }}>{r.populated.toLocaleString()} / {r.total.toLocaleString()}</p>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function DuplicateDetector() {
  const toast = useToast()
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [resolving, setResolving] = useState<DuplicateGroup | null>(null)
  const load = () => { setGroups(null); getDuplicates().then(setGroups).catch(() => setGroups([])) }
  useEffect(load, [])
  return (
    <Card>
      <SectionTitle action={<Button size="sm" variant="ghost" onClick={load}>↻ Refresh</Button>}>Duplicate detector</SectionTitle>
      {!groups ? <Skeleton height={80} /> : groups.length === 0 ? (
        <EmptyState title="No duplicates found — your data looks clean" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.dim}` }}>
              {['Barcode', 'Count', 'Products', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: C.muted, fontSize: 10.5, textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.barcode} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: C.text }}>{g.barcode}</td>
                  <td style={{ padding: '8px 10px' }}><Pill color={C.amber}>{g.count}</Pill></td>
                  <td style={{ padding: '8px 10px', color: C.muted, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.products.map((p) => p.name).join(', ')}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}><Button size="sm" variant="ghost" onClick={() => setResolving(g)}>Resolve</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {resolving && <ResolveModal group={resolving} onClose={() => setResolving(null)} onResolved={() => { setResolving(null); load(); toast('Resolved') }} />}
    </Card>
  )
}

function ResolveModal({ group, onClose, onResolved }: { group: DuplicateGroup; onClose: () => void; onResolved: () => void }) {
  const toast = useToast()
  const [keepId, setKeepId] = useState(group.products[0].id)
  const [mode, setMode] = useState<'keep' | 'merge'>('keep')
  const [busy, setBusy] = useState(false)
  const fields: (keyof Food)[] = ['name', 'brand', 'energy_kj', 'protein_g', 'fat_total_g', 'carbs_g', 'sugar_g', 'fibre_g', 'sodium_mg', 'serving_size_g', 'image_url', 'source']
  // merged selection: field -> productId to take value from
  const [picks, setPicks] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, group.products[0].id])))

  const submit = async () => {
    setBusy(true)
    const deleteIds = group.products.map((p) => p.id).filter((id) => id !== keepId)
    let res
    if (mode === 'keep') res = await resolveDuplicateKeep(keepId, deleteIds)
    else {
      const merged: Partial<Food> = {}
      for (const f of fields) {
        const src = group.products.find((p) => p.id === picks[f as string])
        if (src) (merged as Record<string, unknown>)[f as string] = src[f]
      }
      res = await mergeDuplicates(keepId, merged, deleteIds)
    }
    setBusy(false)
    if (res.ok) onResolved(); else toast(res.error ?? 'Failed', 'error')
  }

  return (
    <Modal open onClose={onClose} title={`Resolve duplicates · ${group.barcode}`} width={760}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Button size="sm" variant={mode === 'keep' ? 'primary' : 'ghost'} onClick={() => setMode('keep')}>Keep one</Button>
        <Button size="sm" variant={mode === 'merge' ? 'primary' : 'ghost'} onClick={() => setMode('merge')}>Merge best values</Button>
      </div>

      {mode === 'keep' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {group.products.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${keepId === p.id ? C.green + '66' : C.dim2}`, cursor: 'pointer' }}>
              <input type="radio" checked={keepId === p.id} onChange={() => setKeepId(p.id)} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{p.name ?? '(no name)'} <Pill color={sourceColor(p.source)}>{sourceLabel(p.source)}</Pill></p>
                <p style={{ fontSize: 11.5, color: C.muted }}>{p.energy_kj ?? '—'} kJ · P {p.protein_g ?? '—'} · C {p.carbs_g ?? '—'} · F {p.fat_total_g ?? '—'}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {mode === 'merge' && (
        <div style={{ overflowX: 'auto' }}>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Pick which row each field's value comes from. Kept row: select below.</p>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.muted }}>Keep row:</span>
            {group.products.map((p, i) => <Button key={p.id} size="sm" variant={keepId === p.id ? 'primary' : 'ghost'} onClick={() => setKeepId(p.id)}>Row {i + 1}</Button>)}
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.dim}` }}><th style={{ textAlign: 'left', padding: 6, color: C.muted }}>Field</th>{group.products.map((p, i) => <th key={p.id} style={{ textAlign: 'left', padding: 6, color: C.muted }}>Row {i + 1}</th>)}</tr></thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f as string} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: 6, color: C.text, fontWeight: 600 }}>{f as string}</td>
                  {group.products.map((p) => (
                    <td key={p.id} style={{ padding: 6 }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: picks[f as string] === p.id ? C.green : C.muted }}>
                        <input type="radio" checked={picks[f as string] === p.id} onChange={() => setPicks((s) => ({ ...s, [f as string]: p.id }))} />
                        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(p[f] ?? '—')}</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={submit} disabled={busy}>{busy ? 'Working…' : mode === 'keep' ? `Keep 1, delete ${group.count - 1}` : `Merge & delete ${group.count - 1}`}</Button>
      </div>
    </Modal>
  )
}

function OutlierDetection() {
  const toast = useToast()
  const [rows, setRows] = useState<OutlierRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => { setRows(null); getOutliers().then(setRows).catch(() => setRows([])) }
  useEffect(load, [])
  const flagAll = async () => {
    if (!rows?.length) return
    setBusy(true)
    const ids = [...new Set(rows.map((r) => r.id))]
    const res = await bulkFlag(ids, 'Outlier detected')
    setBusy(false)
    if (res.ok) { toast(`Flagged ${ids.length}`); load() } else toast(res.error ?? 'Failed', 'error')
  }
  return (
    <Card>
      <SectionTitle action={<div style={{ display: 'flex', gap: 8 }}><Button size="sm" variant="ghost" onClick={load}>↻ Refresh</Button>{rows && rows.length > 0 && <Button size="sm" variant="danger" onClick={flagAll} disabled={busy}>Flag all for review</Button>}</div>}>Outlier detection</SectionTitle>
      {!rows ? <Skeleton height={80} /> : rows.length === 0 ? (
        <EmptyState title="No outliers detected" hint="All values are within sane ranges." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.dim}` }}>{['Product', 'Barcode', 'Issue', 'Value'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: C.muted, fontSize: 10.5, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.id}-${i}`} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: '8px 10px', color: C.text }}>{r.name ?? <span style={{ color: C.red }}>(no name)</span>}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: C.muted }}>{r.barcode ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}><Pill color={C.amber}>{r.field}</Pill></td>
                  <td style={{ padding: '8px 10px', color: C.red, fontWeight: 600 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function MissingBreakdown() {
  const [rows, setRows] = useState<CoverageRow[] | null>(null)
  useEffect(() => { getCoverage().then(setRows).catch(() => setRows([])) }, [])
  const missing = (rows ?? []).map((r) => ({ field: r.field, count: r.total - r.populated })).sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...missing.map((m) => m.count))
  return (
    <Card>
      <SectionTitle>Missing data breakdown</SectionTitle>
      {!rows ? <Skeleton height={120} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missing.map((m) => (
            <div key={m.field} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 130, fontSize: 12, color: C.text, flexShrink: 0 }}>{m.field}</span>
              <span style={{ flex: 1, height: 16, background: C.dim, borderRadius: 4, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(m.count / max) * 100}%`, background: m.count === 0 ? C.green : C.amber }} />
              </span>
              <span style={{ width: 70, textAlign: 'right', fontSize: 12, color: C.muted }}>{m.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function AppSearchPreview() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const run = async () => {
    if (!q.trim()) return
    setLoading(true); setSearched(true)
    const r = await appSearchPreview(q)
    setResults(r); setLoading(false)
  }
  return (
    <Card>
      <SectionTitle>App search preview</SectionTitle>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Simulates the in-app food search (published products only).</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Input placeholder="Search as a user would…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} style={{ maxWidth: 320 }} />
        <Button variant="primary" onClick={run}>Search</Button>
      </div>
      {loading ? <Skeleton height={60} /> : searched && results.length === 0 ? (
        <EmptyState title={`No published results for “${q}”`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map((f) => {
            const cover = (['energy_kj', 'protein_g', 'carbs_g', 'fat_total_g'] as const).filter((k) => f[k] != null).length
            void cover
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: `1px solid ${C.dim}`, borderRadius: 8 }}>
                {f.image_url ? <img src={f.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} /> : <div style={{ width: 40, height: 40, borderRadius: 6, background: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍽</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{f.name ?? '(no name)'}</p>
                  <p style={{ fontSize: 11.5, color: C.muted }}>{f.brand ?? '—'} · <span style={{ color: coverColor(100) }}>{f.energy_kj ?? '—'} kJ</span> · P {f.protein_g ?? '—'} · C {f.carbs_g ?? '—'} · F {f.fat_total_g ?? '—'}</p>
                </div>
                <Pill color={sourceColor(f.source)}>{sourceLabel(f.source)}</Pill>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
