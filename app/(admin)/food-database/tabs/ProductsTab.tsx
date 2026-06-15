'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  queryProducts, upsertProduct, deleteProduct, bulkDelete, bulkSetPublished, bulkFlag,
  setPublished, setFlag, importProducts, type ProductsResult, type ProductInput,
} from '@/app/actions/foodDatabase'
import { coveragePct, type FoodFilters, type FoodSortKey, type FoodStatus } from '@/lib/foodFilters'
import type { Food } from '@/types/database'
import {
  C, Card, Pill, Button, Input, Select, Modal, useToast, Skeleton, EmptyState,
  sourceColor, sourceLabel, coverColor, relativeTime,
} from '../_ui'

const COLS_KEY = 'fdb_visible_columns'
const ALL_SOURCES = ['woolworths', 'coles', 'open_food_facts', 'ollama']

type ColKey = 'image' | 'name' | 'brand' | 'barcode' | 'energy_kj' | 'protein_g' | 'carbs_g' | 'fat_total_g' | 'cover' | 'source' | 'published' | 'flagged' | 'created_at'
const COLUMNS: { key: ColKey; label: string; sort?: FoodSortKey }[] = [
  { key: 'image', label: 'Image' },
  { key: 'name', label: 'Name', sort: 'name' },
  { key: 'brand', label: 'Brand', sort: 'brand' },
  { key: 'barcode', label: 'Barcode', sort: 'barcode' },
  { key: 'energy_kj', label: 'Energy kJ', sort: 'energy_kj' },
  { key: 'protein_g', label: 'Protein g', sort: 'protein_g' },
  { key: 'carbs_g', label: 'Carbs g', sort: 'carbs_g' },
  { key: 'fat_total_g', label: 'Fat g', sort: 'fat_total_g' },
  { key: 'cover', label: 'Cover %' },
  { key: 'source', label: 'Source', sort: 'source' },
  { key: 'published', label: 'Published', sort: 'is_published' },
  { key: 'flagged', label: 'Flagged', sort: 'flagged_for_review' },
  { key: 'created_at', label: 'Created', sort: 'created_at' },
]
const DEFAULT_COLS: ColKey[] = COLUMNS.map((c) => c.key)

export default function ProductsTab({ brands, initialProducts }: { brands: string[]; initialProducts: ProductsResult }) {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ---- filter state (hydrated from URL) ----
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [sources, setSources] = useState<string[]>(searchParams.get('sources')?.split(',').filter(Boolean) ?? [])
  const [brand, setBrand] = useState(searchParams.get('brand') ?? '')
  const [status, setStatus] = useState<FoodStatus>((searchParams.get('status') as FoodStatus) ?? 'all')
  const [missingMacros, setMissingMacros] = useState(searchParams.get('missingMacros') === '1')
  const [missingImage, setMissingImage] = useState(searchParams.get('missingImage') === '1')
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '')
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50)
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [sortKey, setSortKey] = useState<FoodSortKey>((searchParams.get('sortKey') as FoodSortKey) ?? 'created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sortDir') as 'asc' | 'desc') ?? 'desc')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [ranges, setRanges] = useState<FoodFilters['ranges']>({})

  const [result, setResult] = useState<ProductsResult>(initialProducts)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // visible columns
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS)
  const [colsMenu, setColsMenu] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem(COLS_KEY)
    if (saved) { try { setVisibleCols(JSON.parse(saved)) } catch {} }
  }, [])
  const toggleCol = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      localStorage.setItem(COLS_KEY, JSON.stringify(next))
      return next
    })
  }

  // modals
  const [editing, setEditing] = useState<Food | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Food | null>(null)
  const [rawViewer, setRawViewer] = useState<Food | null>(null)
  const [importing, setImporting] = useState(false)

  const filters: FoodFilters = useMemo(() => ({
    search, sources, brand: brand || undefined, status, missingMacros, missingImage,
    dateFrom: dateFrom || null, dateTo: dateTo || null, ranges, sortKey, sortDir,
  }), [search, sources, brand, status, missingMacros, missingImage, dateFrom, dateTo, ranges, sortKey, sortDir])

  // sync to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'products')
    const setOrDel = (k: string, v: string | undefined | null) => { if (v) params.set(k, v); else params.delete(k) }
    setOrDel('q', search)
    setOrDel('sources', sources.join(','))
    setOrDel('brand', brand)
    setOrDel('status', status !== 'all' ? status : '')
    setOrDel('missingMacros', missingMacros ? '1' : '')
    setOrDel('missingImage', missingImage ? '1' : '')
    setOrDel('dateFrom', dateFrom)
    setOrDel('dateTo', dateTo)
    setOrDel('pageSize', pageSize !== 50 ? String(pageSize) : '')
    setOrDel('page', page !== 1 ? String(page) : '')
    setOrDel('sortKey', sortKey !== 'created_at' ? sortKey : '')
    setOrDel('sortDir', sortDir !== 'desc' ? sortDir : '')
    for (const f of ['energy_kj', 'protein_g', 'carbs_g', 'fat_total_g', 'fibre_g', 'sodium_mg'] as const) {
      setOrDel(`${f}_min`, ranges?.[f]?.min != null ? String(ranges[f]!.min) : '')
      setOrDel(`${f}_max`, ranges?.[f]?.max != null ? String(ranges[f]!.max) : '')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sources, brand, status, missingMacros, missingImage, dateFrom, dateTo, pageSize, page, sortKey, sortDir, ranges])

  // fetch (debounced for search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchNow = useCallback(async () => {
    setLoading(true)
    const res = await queryProducts(filters, page, pageSize)
    setResult(res)
    setLoading(false)
    if (res.error) toast(res.error, 'error')
  }, [filters, page, pageSize, toast])

  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchNow, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, pageSize])

  const refresh = () => fetchNow()

  const onSort = (key: FoodSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const resetFilters = () => {
    setSearch(''); setSources([]); setBrand(''); setStatus('all'); setMissingMacros(false)
    setMissingImage(false); setDateFrom(''); setDateTo(''); setRanges({}); setPage(1)
  }

  const rows = result.rows
  const total = result.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id))
      else rows.forEach((r) => next.add(r.id))
      return next
    })
  }
  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // bulk actions
  const runBulk = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    const res = await fn()
    if (res.ok) { toast(okMsg); setSelected(new Set()); refresh() }
    else toast(res.error ?? 'Action failed', 'error')
  }
  const selectedIds = [...selected]

  const exportUrl = () => {
    const params = new URLSearchParams()
    if (selectedIds.length) params.set('ids', selectedIds.join(','))
    else {
      if (search) params.set('q', search)
      if (sources.length) params.set('sources', sources.join(','))
      if (brand) params.set('brand', brand)
      if (status !== 'all') params.set('status', status)
      if (missingMacros) params.set('missingMacros', '1')
      if (missingImage) params.set('missingImage', '1')
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('sortKey', sortKey); params.set('sortDir', sortDir)
    }
    return `/api/food-export?${params.toString()}`
  }

  const colVisible = (k: ColKey) => visibleCols.includes(k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 280 }}>
            <Input placeholder="Search name, brand, barcode…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 260 }} />
            <MultiSelect label="Sources" options={ALL_SOURCES} selected={sources} onChange={(v) => { setSources(v); setPage(1) }} render={(s) => sourceLabel(s)} />
            <Select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1) }} style={{ maxWidth: 180 }}>
              <option value="">All brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Select value={status} onChange={(e) => { setStatus(e.target.value as FoodStatus); setPage(1) }}>
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
              <option value="flagged">Flagged</option>
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm" variant="ghost" onClick={() => setImporting(true)}>Import CSV</Button>
            <a href={exportUrl()} style={{ textDecoration: 'none' }}><Button size="sm" variant="ghost">Export CSV</Button></a>
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>+ Add Product</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <ToggleChip active={missingMacros} onClick={() => { setMissingMacros((v) => !v); setPage(1) }}>Missing macros</ToggleChip>
          <ToggleChip active={missingImage} onClick={() => { setMissingImage((v) => !v); setPage(1) }}>Missing image</ToggleChip>
          <label style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>From <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} style={{ width: 150 }} /></label>
          <label style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>To <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} style={{ width: 150 }} /></label>
          <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? 'Hide' : 'Advanced'} filters</Button>
          <div style={{ position: 'relative' }}>
            <Button size="sm" variant="ghost" onClick={() => setColsMenu((v) => !v)}>Columns</Button>
            {colsMenu && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, background: C.surface, border: `1px solid ${C.dim2}`, borderRadius: 8, padding: 10, width: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                {COLUMNS.map((c) => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12.5, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={colVisible(c.key)} onChange={() => toggleCol(c.key)} />{c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={resetFilters}>Reset filters</Button>
        </div>

        {showAdvanced && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.dim}` }}>
            {([['energy_kj', 'Energy (kJ)'], ['protein_g', 'Protein (g)'], ['carbs_g', 'Carbs (g)'], ['fat_total_g', 'Fat (g)'], ['fibre_g', 'Fibre (g)'], ['sodium_mg', 'Sodium (mg)']] as const).map(([f, label]) => (
              <div key={f}>
                <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5 }}>{label}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Input type="number" placeholder="min" value={ranges?.[f]?.min ?? ''} onChange={(e) => { setRanges((r) => ({ ...r, [f]: { ...r?.[f], min: e.target.value === '' ? undefined : Number(e.target.value) } })); setPage(1) }} />
                  <Input type="number" placeholder="max" value={ranges?.[f]?.max ?? ''} onChange={(e) => { setRanges((r) => ({ ...r, [f]: { ...r?.[f], max: e.target.value === '' ? undefined : Number(e.target.value) } })); setPage(1) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card style={{ padding: 12, borderColor: C.green + '66', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{selected.size} selected</span>
          <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete ${selected.size} products? This cannot be undone.`)) runBulk(() => bulkDelete(selectedIds), 'Deleted') }}>Delete selected ({selected.size})</Button>
          <Button size="sm" variant="ghost" onClick={() => runBulk(() => bulkSetPublished(selectedIds, true), 'Published')}>Publish</Button>
          <Button size="sm" variant="ghost" onClick={() => runBulk(() => bulkSetPublished(selectedIds, false), 'Unpublished')}>Unpublish</Button>
          <Button size="sm" variant="ghost" onClick={() => runBulk(() => bulkFlag(selectedIds), 'Flagged')}>Flag for review</Button>
          <a href={exportUrl()} style={{ textDecoration: 'none' }}><Button size="sm" variant="ghost">Export selected CSV</Button></a>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </Card>
      )}

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'visible' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.dim}`, background: C.surface }}>
                <th style={{ padding: '10px 12px', width: 36 }}><input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} /></th>
                {COLUMNS.filter((c) => colVisible(c.key)).map((c) => (
                  <th
                    key={c.key}
                    onClick={() => c.sort && onSort(c.sort)}
                    style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: c.sort ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    {c.label}{c.sort && sortKey === c.sort ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th style={{ padding: '10px 12px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td colSpan={visibleCols.length + 2} style={{ padding: '10px 12px' }}><Skeleton height={20} /></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={visibleCols.length + 2}><EmptyState title="No products match your filters" hint="Try clearing them to see more results." /></td></tr>
              )}
              {rows.map((f) => (
                <ProductRow
                  key={f.id} food={f} visibleCols={visibleCols} selected={selected.has(f.id)}
                  onToggle={() => toggleSelect(f.id)}
                  onEdit={() => setEditing(f)}
                  onDelete={() => setDeleting(f)}
                  onRaw={() => setRawViewer(f)}
                  onTogglePublish={async () => { const r = await setPublished(f.id, !(f.is_published ?? false)); if (r.ok) { toast('Updated'); refresh() } else toast(r.error ?? 'Failed', 'error') }}
                  onToggleFlag={async () => { const r = await setFlag(f.id, !(f.flagged_for_review ?? false)); if (r.ok) { toast('Updated'); refresh() } else toast(r.error ?? 'Failed', 'error') }}
                  toast={toast}
                />
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${C.dim}`, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: C.muted }}>Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} products</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
            <span style={{ fontSize: 12.5, color: C.text, padding: '0 8px' }}>Page {page} / {totalPages}</span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {(editing || adding) && (
        <ProductFormModal
          food={editing}
          onClose={() => { setEditing(null); setAdding(false) }}
          onSaved={() => { setEditing(null); setAdding(false); refresh() }}
        />
      )}
      <DeleteModal food={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); refresh() }} />
      <RawViewer food={rawViewer} onClose={() => setRawViewer(null)} />
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); refresh() }} />}
    </div>
  )
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: active ? `${C.green}22` : 'transparent', color: active ? C.green : C.muted,
      border: `1px solid ${active ? C.green + '66' : C.dim2}`,
    }}>{children}</button>
  )
}

function MultiSelect({ label, options, selected, onChange, render }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; render: (o: string) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} style={{ padding: '8px 11px' }}>
        {label}{selected.length ? ` (${selected.length})` : ''} ▾
      </Button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: C.surface, border: `1px solid ${C.dim2}`, borderRadius: 8, padding: 10, width: 190, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {options.map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12.5, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])} />
              {render(o)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({ food, visibleCols, selected, onToggle, onEdit, onDelete, onRaw, onTogglePublish, onToggleFlag, toast }: {
  food: Food; visibleCols: ColKey[]; selected: boolean
  onToggle: () => void; onEdit: () => void; onDelete: () => void; onRaw: () => void
  onTogglePublish: () => void; onToggleFlag: () => void; toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [menu, setMenu] = useState(false)
  const [preview, setPreview] = useState(false)
  const cover = coveragePct(food as unknown as Record<string, unknown>)
  const has = (k: ColKey) => visibleCols.includes(k)
  const cell: React.CSSProperties = { padding: '9px 12px', color: C.text, whiteSpace: 'nowrap' }

  return (
    <tr style={{ borderBottom: `1px solid ${C.dim}`, background: selected ? `${C.green}0d` : 'transparent' }}>
      <td style={{ padding: '9px 12px' }}><input type="checkbox" checked={selected} onChange={onToggle} /></td>
      {has('image') && (
        <td style={cell}>
          {food.image_url ? (
            <img src={food.image_url} alt="" onClick={() => setPreview(true)} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${C.dim2}` }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 6, background: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted2, fontSize: 16 }}>🍽</div>
          )}
        </td>
      )}
      {has('name') && <td style={{ ...cell, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{food.name ?? <span style={{ color: C.red }}>(no name)</span>}</td>}
      {has('brand') && <td style={{ ...cell, color: C.muted }}>{food.brand ?? '—'}</td>}
      {has('barcode') && <td style={{ ...cell, fontFamily: 'monospace', color: C.muted }}>{food.barcode ?? '—'}</td>}
      {has('energy_kj') && <td style={cell}>{food.energy_kj ?? '—'}</td>}
      {has('protein_g') && <td style={cell}>{food.protein_g ?? '—'}</td>}
      {has('carbs_g') && <td style={cell}>{food.carbs_g ?? '—'}</td>}
      {has('fat_total_g') && <td style={cell}>{food.fat_total_g ?? '—'}</td>}
      {has('cover') && (
        <td style={cell}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 36, height: 5, borderRadius: 3, background: C.dim, overflow: 'hidden', display: 'inline-block' }}>
              <span style={{ display: 'block', width: `${cover}%`, height: '100%', background: coverColor(cover) }} />
            </span>
            <span style={{ fontSize: 11, color: coverColor(cover) }}>{cover}%</span>
          </span>
        </td>
      )}
      {has('source') && <td style={cell}><Pill color={sourceColor(food.source)}>{sourceLabel(food.source)}</Pill></td>}
      {has('published') && (
        <td style={cell}>
          <button onClick={onTogglePublish} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: food.is_published ? C.green : C.muted2 }} title={food.is_published ? 'Published — click to unpublish' : 'Unpublished — click to publish'}>
            {food.is_published ? '✓' : '–'}
          </button>
        </td>
      )}
      {has('flagged') && <td style={cell}>{food.flagged_for_review ? <span title={food.flag_reason ?? 'Flagged'} style={{ color: C.amber, fontSize: 14 }}>⚑</span> : <span style={{ color: C.muted2 }}>—</span>}</td>}
      {has('created_at') && <td style={{ ...cell, color: C.muted }}>{relativeTime(food.created_at)}</td>}
      <td style={{ padding: '9px 12px', textAlign: 'right', position: 'relative', whiteSpace: 'nowrap' }}>
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>{' '}
        <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>{' '}
        <button onClick={() => setMenu((v) => !v)} style={{ background: 'transparent', border: `1px solid ${C.dim2}`, borderRadius: 7, color: C.text, cursor: 'pointer', padding: '5px 9px', fontSize: 14 }}>⋮</button>
        {menu && (
          <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 60, background: C.surface, border: `1px solid ${C.dim2}`, borderRadius: 8, padding: 6, width: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', textAlign: 'left' }}>
            <MenuItem onClick={() => { setMenu(false); onRaw() }}>View Raw</MenuItem>
            <MenuItem onClick={() => { setMenu(false); if (food.barcode) { navigator.clipboard.writeText(food.barcode); toast('Barcode copied — re-run enrichment locally', 'info') } }}>Re-enrich (copy barcode)</MenuItem>
            <MenuItem onClick={() => { setMenu(false); onToggleFlag() }}>{food.flagged_for_review ? 'Unflag' : 'Flag for review'}</MenuItem>
            <MenuItem onClick={() => { setMenu(false); if (food.barcode) { navigator.clipboard.writeText(food.barcode); toast('Barcode copied') } }}>Copy barcode</MenuItem>
            {food.barcode && <MenuItem onClick={() => { setMenu(false); window.open(`https://world.openfoodfacts.org/product/${food.barcode}`, '_blank') }}>Open in Open Food Facts</MenuItem>}
          </div>
        )}
        {preview && food.image_url && (
          <div onClick={() => setPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <img src={food.image_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12 }} />
          </div>
        )}
      </td>
    </tr>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', padding: '7px 9px', fontSize: 12.5, borderRadius: 6 }} onMouseEnter={(e) => (e.currentTarget.style.background = C.dim)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{children}</button>
}

const NUM_FIELDS: { key: keyof Food; label: string; warnAbove?: number }[] = [
  { key: 'serving_size_g', label: 'Serving size (g)' },
  { key: 'energy_kj', label: 'Energy (kJ)', warnAbove: 4000 },
  { key: 'protein_g', label: 'Protein (g)', warnAbove: 100 },
  { key: 'fat_total_g', label: 'Fat total (g)', warnAbove: 100 },
  { key: 'fat_saturated_g', label: 'Fat saturated (g)' },
  { key: 'carbs_g', label: 'Carbs (g)', warnAbove: 100 },
  { key: 'sugar_g', label: 'Sugar (g)' },
  { key: 'fibre_g', label: 'Fibre (g)' },
  { key: 'sodium_mg', label: 'Sodium (mg)' },
]

function ProductFormModal({ food, onClose, onSaved }: { food: Food | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<Record<string, string | boolean>>(() => {
    const base: Record<string, string | boolean> = {
      name: food?.name ?? '', brand: food?.brand ?? '', barcode: food?.barcode ?? '',
      source: food?.source ?? 'manual', image_url: food?.image_url ?? '',
      is_published: food?.is_published ?? true, flagged_for_review: food?.flagged_for_review ?? false,
      flag_reason: food?.flag_reason ?? '',
    }
    for (const f of NUM_FIELDS) base[f.key as string] = food?.[f.key] != null ? String(food[f.key]) : ''
    return base
  })
  const [saving, setSaving] = useState(false)

  const warnings = NUM_FIELDS.filter((f) => f.warnAbove && Number(form[f.key as string]) > f.warnAbove).map((f) => f.label)

  const save = async () => {
    if (!String(form.barcode).trim()) { toast('Barcode is required', 'error'); return }
    setSaving(true)
    const input: ProductInput = {
      barcode: String(form.barcode).trim(),
      name: String(form.name) || null,
      brand: String(form.brand) || null,
      source: String(form.source) || null,
      image_url: String(form.image_url) || null,
      is_published: !!form.is_published,
      flagged_for_review: !!form.flagged_for_review,
      flag_reason: form.flagged_for_review ? (String(form.flag_reason) || null) : null,
    }
    if (food?.id) (input as Record<string, unknown>).id = food.id
    for (const f of NUM_FIELDS) {
      const v = String(form[f.key as string])
      ;(input as Record<string, unknown>)[f.key as string] = v === '' ? null : Number(v)
    }
    const res = await upsertProduct(input)
    setSaving(false)
    if (res.ok) { toast('Saved'); onSaved() }
    else toast(res.error ?? 'Save failed', 'error')
  }

  const set = (k: string, v: string | boolean) => setForm((s) => ({ ...s, [k]: v }))

  return (
    <Modal open onClose={onClose} title={food ? 'Edit product' : 'Add product'} width={620}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Name"><Input value={String(form.name)} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Brand"><Input value={String(form.brand)} onChange={(e) => set('brand', e.target.value)} /></Field>
        <Field label="Barcode *"><Input value={String(form.barcode)} onChange={(e) => set('barcode', e.target.value)} /></Field>
        <Field label="Source">
          <Select value={String(form.source)} onChange={(e) => set('source', e.target.value)} style={{ width: '100%' }}>
            {['woolworths', 'coles', 'open_food_facts', 'ollama', 'manual'].map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
          </Select>
        </Field>
        {NUM_FIELDS.map((f) => (
          <Field key={f.key as string} label={f.label}><Input type="number" value={String(form[f.key as string])} onChange={(e) => set(f.key as string, e.target.value)} /></Field>
        ))}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Image URL">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Input value={String(form.image_url)} onChange={(e) => set('image_url', e.target.value)} />
              {form.image_url && <img src={String(form.image_url)} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: `1px solid ${C.dim2}`, flexShrink: 0 }} />}
            </div>
          </Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
          <input type="checkbox" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} /> Published
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
          <input type="checkbox" checked={!!form.flagged_for_review} onChange={(e) => set('flagged_for_review', e.target.checked)} /> Flagged for review
        </label>
        {form.flagged_for_review && (
          <div style={{ gridColumn: '1 / -1' }}><Field label="Flag reason"><Input value={String(form.flag_reason)} onChange={(e) => set('flag_reason', e.target.value)} placeholder="Why is this flagged?" /></Field></div>
        )}
      </div>

      {warnings.length > 0 && (
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: `${C.amber}1a`, border: `1px solid ${C.amber}55`, fontSize: 12.5, color: C.amber }}>
          Unusual value — please verify: {warnings.join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </Modal>
  )
}

function DeleteModal({ food, onClose, onDeleted }: { food: Food | null; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!food) return null
  const del = async () => {
    setBusy(true)
    const res = await deleteProduct(food.id)
    setBusy(false)
    if (res.ok) { toast('Deleted'); onDeleted() } else toast(res.error ?? 'Delete failed', 'error')
  }
  return (
    <Modal open onClose={onClose} title="Delete product" width={440}>
      <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>Delete <strong>{food.name ?? '(no name)'}</strong>? This cannot be undone.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={del} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
      </div>
    </Modal>
  )
}

function RawViewer({ food, onClose }: { food: Food | null; onClose: () => void }) {
  const toast = useToast()
  if (!food) return null
  const json = JSON.stringify(food.raw_data ?? food, null, 2)
  return (
    <Modal open onClose={onClose} title="Raw data" width={680}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(json); toast('JSON copied') }}>Copy JSON</Button>
      </div>
      <pre style={{ background: C.bg, border: `1px solid ${C.dim2}`, borderRadius: 8, padding: 14, fontSize: 12, color: C.cyan, overflowX: 'auto', maxHeight: 460, fontFamily: 'monospace' }}>{json}</pre>
    </Modal>
  )
}

// --- CSV import -------------------------------------------------------------
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cur.push(field); field = '' }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
    return obj
  })
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = () => setRows(parseCSV(String(reader.result)))
    reader.readAsText(file)
  }

  const doImport = async () => {
    setBusy(true)
    const res = await importProducts(rows)
    setBusy(false)
    if (res.error) { toast(res.error, 'error'); return }
    setSummary(`Imported: ${res.inserted} inserted, ${res.updated} updated, ${res.skipped} skipped (missing barcode)`)
    toast('Import complete')
  }

  const headers = rows.length ? Object.keys(rows[0]) : []

  return (
    <Modal open onClose={onClose} title="Import CSV" width={720}>
      {!rows.length && !summary && (
        <div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Upload a CSV with the same headers as the export. Rows are upserted using <code>barcode</code> as the conflict key.</p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ color: C.text }} />
        </div>
      )}
      {rows.length > 0 && !summary && (
        <div>
          <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>{filename} — {rows.length} rows. Preview of first 5:</p>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.dim2}`, borderRadius: 8 }}>
            <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.dim}` }}>{headers.map((h) => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: C.muted, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.dim}` }}>{headers.map((h) => <td key={h} style={{ padding: '6px 8px', color: C.text, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[h]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {!headers.includes('barcode') && <p style={{ fontSize: 12, color: C.red, marginTop: 10 }}>⚠ No “barcode” column found — all rows will be skipped.</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button variant="ghost" onClick={() => { setRows([]); setFilename('') }}>Choose another</Button>
            <Button variant="primary" onClick={doImport} disabled={busy}>{busy ? 'Importing…' : `Import ${rows.length} rows`}</Button>
          </div>
        </div>
      )}
      {summary && (
        <div>
          <p style={{ fontSize: 14, color: C.green, fontWeight: 600, marginBottom: 16 }}>{summary}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="primary" onClick={onDone}>Done</Button></div>
        </div>
      )}
    </Modal>
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
