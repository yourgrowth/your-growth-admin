'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  C, Card, Button, Input, Textarea, Select, Field, Modal, ConfirmDialog, Pill,
  EmptyState, Skeleton, useToast, relativeTime,
} from './kit'
import type { ResourceConfig, Field as FieldDef } from '@/lib/admin/resources'
import {
  listResource, upsertResource, deleteResource, bulkDeleteResource, searchProfiles,
  type Row, type RefLabels, type ListResult,
} from '@/app/actions/resources'

type FormState = Record<string, string | boolean>

export default function ResourceManager({ config, initial }: { config: ResourceConfig; initial: ListResult }) {
  const toast = useToast()
  const pk = config.primaryKey

  const [rows, setRows] = useState<Row[]>(initial.rows)
  const [refLabels, setRefLabels] = useState<RefLabels>(initial.refLabels)
  const [total, setTotal] = useState(initial.total)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortKey, setSortKey] = useState(config.defaultSort.key)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(config.defaultSort.dir)
  const [userId, setUserId] = useState('')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const [rawRow, setRawRow] = useState<Row | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tableFields = useMemo(() => config.fields.filter((f) => f.inTable), [config.fields])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listResource(config.table, { page, pageSize, search, sortKey, sortDir, userId: userId || undefined })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    setRows(res.rows)
    setRefLabels(res.refLabels)
    setTotal(res.total)
    setSelected(new Set())
  }, [config.table, page, pageSize, search, sortKey, sortDir, userId, toast])

  // reload on paging / sort / user filter changes
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    load()
  }, [page, pageSize, sortKey, sortDir, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); load() }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  function renderCell(field: FieldDef, row: Row) {
    const v = row[field.key]
    if (v === null || v === undefined || v === '') return <span style={{ color: C.muted2 }}>—</span>
    switch (field.type) {
      case 'boolean':
        return <Pill color={v ? C.green : C.muted2}>{v ? 'yes' : 'no'}</Pill>
      case 'ref': {
        const label = refLabels[`${field.key}:${v as string}`]
        return <span style={{ color: C.blue }}>{label ?? `${String(v).slice(0, 8)}…`}</span>
      }
      case 'json':
      case 'array':
        return (
          <button onClick={(e) => { e.stopPropagation(); setRawRow(row) }} style={{ background: 'transparent', border: 'none', color: C.purple, cursor: 'pointer', fontSize: 12 }}>
            {Array.isArray(v) ? `[${(v as unknown[]).length}]` : '{…}'}
          </button>
        )
      case 'datetime':
        return <span style={{ color: C.muted, fontSize: 12 }} title={String(v)}>{relativeTime(String(v))}</span>
      case 'number':
        return <span style={{ color: C.cyan }}>{String(v)}</span>
      case 'uuid':
        return <span style={{ color: C.muted2, fontFamily: 'monospace', fontSize: 11 }}>{String(v).slice(0, 8)}…</span>
      default: {
        const s = String(v)
        return <span title={s}>{s.length > 60 ? s.slice(0, 60) + '…' : s}</span>
      }
    }
  }

  async function handleDelete(row: Row) {
    const res = await deleteResource(config.table, String(row[pk]))
    if (res.error) { toast(res.error, 'error'); return }
    toast(`${config.singular} deleted`)
    load()
  }

  async function handleBulkDelete() {
    const res = await bulkDeleteResource(config.table, [...selected])
    if (res.error) { toast(res.error, 'error'); return }
    toast(`Deleted ${selected.size} ${config.label.toLowerCase()}`)
    load()
  }

  function exportCsv() {
    const cols = config.fields.map((f) => f.key)
    const esc = (val: unknown) => {
      if (val === null || val === undefined) return ''
      const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.table}_page${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(String(r[pk])))

  return (
    <div>
      {/* toolbar */}
      <Card style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {config.searchFields.length > 0 && (
            <Input
              placeholder={`Search ${config.searchFields.join(', ')}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          )}
          {config.userScoped && (
            <UserFilter value={userId} onChange={(id) => { setUserId(id); setPage(1) }} />
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: C.muted }}>{total.toLocaleString()} total</span>
          <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 'auto' }}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </Select>
          <Button variant="ghost" size="sm" onClick={() => load()}>Refresh</Button>
          <Button variant="ghost" size="sm" onClick={exportCsv}>Export CSV</Button>
          {config.creatable && <Button variant="primary" size="sm" onClick={() => setCreating(true)}>+ New {config.singular}</Button>}
        </div>
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.dim}` }}>
            <span style={{ fontSize: 12.5, color: C.text }}>{selected.size} selected</span>
            {config.deletable && <Button variant="danger" size="sm" onClick={() => setConfirmBulk(true)}>Delete selected</Button>}
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </Card>

      {/* table */}
      <div style={{ border: `1px solid ${C.dim}`, borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surface, borderBottom: `1px solid ${C.dim}` }}>
              <th style={{ padding: '10px 12px', width: 36 }}>
                <input
                  type="checkbox" checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => String(r[pk]))) : new Set())}
                />
              </th>
              {tableFields.map((f) => (
                <th
                  key={f.key}
                  onClick={() => toggleSort(f.key)}
                  style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {f.label}{sortKey === f.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th style={{ padding: '10px 12px', width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}><td colSpan={tableFields.length + 2} style={{ padding: '8px 12px', background: C.bg }}><Skeleton height={20} /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={tableFields.length + 2} style={{ background: C.bg }}><EmptyState title={`No ${config.label.toLowerCase()} found`} hint={search ? 'Try a different search.' : undefined} /></td></tr>
            ) : (
              rows.map((row) => {
                const idv = String(row[pk])
                const sel = selected.has(idv)
                return (
                  <tr
                    key={idv}
                    onClick={() => setEditing(row)}
                    style={{ background: sel ? `${C.green}11` : C.bg, borderBottom: `1px solid ${C.dim}`, cursor: 'pointer' }}
                  >
                    <td style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox" checked={sel}
                        onChange={(e) => {
                          const next = new Set(selected)
                          if (e.target.checked) next.add(idv); else next.delete(idv)
                          setSelected(next)
                        }}
                      />
                    </td>
                    {tableFields.map((f) => (
                      <td key={f.key} style={{ padding: '9px 12px', color: C.text, maxWidth: 280 }}>{renderCell(f, row)}</td>
                    ))}
                    <td style={{ padding: '9px 12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Button variant="ghost" size="sm" onClick={() => setRawRow(row)} title="View raw JSON">{'{}'}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>Edit</Button>
                        {config.deletable && <Button variant="danger" size="sm" onClick={() => setConfirmDelete(row)}>✕</Button>}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ fontSize: 12, color: C.muted }}>Page {page} of {totalPages}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</Button>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next →</Button>
        </div>
      </div>

      {/* editor */}
      {(editing || creating) && (
        <RecordEditor
          config={config}
          row={editing}
          refLabels={refLabels}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => { setEditing(null); setCreating(false); load() }}
        />
      )}

      {/* raw json */}
      <Modal open={!!rawRow} onClose={() => setRawRow(null)} title="Raw record" width={680}>
        <pre style={{ background: C.bg, border: `1px solid ${C.dim}`, borderRadius: 8, padding: 14, fontSize: 12, color: C.text, overflow: 'auto', maxHeight: '60vh', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {rawRow ? JSON.stringify(rawRow, null, 2) : ''}
        </pre>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title={`Delete ${config.singular}?`} body="This permanently removes the record. This cannot be undone."
      />
      <ConfirmDialog
        open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={handleBulkDelete}
        title={`Delete ${selected.size} records?`} body="This permanently removes every selected record. This cannot be undone."
      />
    </div>
  )
}

// --- editor -----------------------------------------------------------------
function RecordEditor({ config, row, refLabels, onClose, onSaved }: {
  config: ResourceConfig; row: Row | null; refLabels: RefLabels
  onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const isEdit = !!row
  const editable = config.fields.filter((f) => f.editable)

  const [form, setForm] = useState<FormState>(() => {
    const init: FormState = {}
    for (const f of editable) {
      const v = row ? row[f.key] : undefined
      if (f.type === 'boolean') init[f.key] = Boolean(v)
      else if (f.type === 'json' || f.type === 'array') init[f.key] = v != null ? JSON.stringify(v, null, 2) : ''
      else init[f.key] = v != null ? String(v) : ''
    }
    return init
  })
  const [saving, setSaving] = useState(false)

  function set(key: string, value: string | boolean) { setForm((f) => ({ ...f, [key]: value })) }

  async function save() {
    setSaving(true)
    const values: Record<string, unknown> = {}
    for (const f of editable) values[f.key] = form[f.key]
    const res = await upsertResource(config.table, values, isEdit ? String(row![config.primaryKey]) : undefined)
    setSaving(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(isEdit ? `${config.singular} updated` : `${config.singular} created`)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${config.singular}` : `New ${config.singular}`} width={620}>
      {editable.map((f) => (
        <Field key={f.key} label={f.label} hint={f.type === 'json' || f.type === 'array' ? 'JSON' : f.type === 'ref' ? (refLabels[`${f.key}:${form[f.key]}`] ?? undefined) : undefined}>
          {f.type === 'boolean' ? (
            <Select value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value === 'true')}>
              <option value="true">true</option>
              <option value="false">false</option>
            </Select>
          ) : f.type === 'select' ? (
            <Select value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">—</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : f.type === 'json' || f.type === 'array' ? (
            <Textarea value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} rows={6} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          ) : f.type === 'longtext' ? (
            <Textarea value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} rows={4} />
          ) : f.type === 'ref' && f.ref?.table === 'profiles' ? (
            <ProfilePickerField value={String(form[f.key] ?? '')} onChange={(id) => set(f.key, id)} />
          ) : (
            <Input
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
              value={String(form[f.key] ?? '')}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.type === 'ref' ? 'uuid' : f.type === 'datetime' ? 'ISO timestamp' : undefined}
            />
          )}
        </Field>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}</Button>
      </div>
    </Modal>
  )
}

// --- profile picker (used for user_id ref editing + filtering) ---------------
function ProfilePickerField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<{ id: string; label: string }[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => setOpts(await searchProfiles(q)), 300)
    return () => clearTimeout(t)
  }, [q, open])
  return (
    <div style={{ position: 'relative' }}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setOpen(true)} placeholder="user uuid — type below to search" />
      {open && (
        <div style={{ marginTop: 6 }}>
          <Input placeholder="search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          {opts.length > 0 && (
            <div style={{ border: `1px solid ${C.dim2}`, borderRadius: 7, marginTop: 4, maxHeight: 180, overflow: 'auto' }}>
              {opts.map((o) => (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.dim}`, color: C.text, padding: '7px 10px', fontSize: 12.5, cursor: 'pointer' }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UserFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<{ id: string; label: string }[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => setOpts(await searchProfiles(q)), 300)
    return () => clearTimeout(t)
  }, [q, open])
  if (value) {
    return (
      <Pill color={C.blue}>
        user filtered
        <button onClick={() => onChange('')} style={{ background: 'transparent', border: 'none', color: C.blue, cursor: 'pointer', marginLeft: 4 }}>×</button>
      </Pill>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <Input placeholder="filter by user…" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} style={{ maxWidth: 200 }} />
      {open && opts.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: C.surface, border: `1px solid ${C.dim2}`, borderRadius: 7, marginTop: 4, minWidth: 220, maxHeight: 200, overflow: 'auto' }}>
          {opts.map((o) => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.dim}`, color: C.text, padding: '7px 10px', fontSize: 12.5, cursor: 'pointer' }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
