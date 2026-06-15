'use client'

import { useEffect, useState } from 'react'
import { setAllPublished, clearScraperRuns, deleteAllFoods } from '@/app/actions/foodDatabase'
import { C, Card, SectionTitle, Button, Input, Modal, useToast } from '../_ui'

const COLS_KEY = 'fdb_visible_columns'
const REFRESH_KEY = 'fdb_refresh_interval'

const ALL_COLS: { key: string; label: string }[] = [
  { key: 'image', label: 'Image' }, { key: 'name', label: 'Name' }, { key: 'brand', label: 'Brand' },
  { key: 'barcode', label: 'Barcode' }, { key: 'energy_kj', label: 'Energy kJ' }, { key: 'protein_g', label: 'Protein g' },
  { key: 'carbs_g', label: 'Carbs g' }, { key: 'fat_total_g', label: 'Fat g' }, { key: 'cover', label: 'Cover %' },
  { key: 'source', label: 'Source' }, { key: 'published', label: 'Published' }, { key: 'flagged', label: 'Flagged' },
  { key: 'created_at', label: 'Created' },
]

export default function SettingsTab() {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmPublish, setConfirmPublish] = useState<null | boolean>(null)
  const [confirmRuns, setConfirmRuns] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  const [cols, setCols] = useState<string[]>(ALL_COLS.map((c) => c.key))
  const [refresh, setRefresh] = useState(30000)

  useEffect(() => {
    const savedCols = localStorage.getItem(COLS_KEY)
    if (savedCols) { try { setCols(JSON.parse(savedCols)) } catch {} }
    const savedRefresh = localStorage.getItem(REFRESH_KEY)
    if (savedRefresh) setRefresh(Number(savedRefresh))
  }, [])

  const toggleCol = (key: string) => {
    setCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      localStorage.setItem(COLS_KEY, JSON.stringify(next))
      return next
    })
  }

  const saveRefresh = (v: number) => { setRefresh(v); localStorage.setItem(REFRESH_KEY, String(v)); toast('Saved') }

  const doPublish = async () => {
    if (confirmPublish === null) return
    setBusy('publish')
    const res = await setAllPublished(confirmPublish)
    setBusy(null); setConfirmPublish(null)
    if (res.ok) toast(confirmPublish ? 'All products published' : 'All products unpublished'); else toast(res.error ?? 'Failed', 'error')
  }

  const doClearRuns = async () => {
    setBusy('runs')
    const res = await clearScraperRuns()
    setBusy(null); setConfirmRuns(false)
    if (res.ok) toast('Scraper run logs cleared'); else toast(res.error ?? 'Failed', 'error')
  }

  const doDeleteAll = async () => {
    setBusy('delete')
    const res = await deleteAllFoods(deleteText)
    setBusy(null)
    if (res.ok) { toast('All food products deleted'); setDeleteOpen(false); setDeleteText('') } else toast(res.error ?? 'Failed', 'error')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Card>
        <SectionTitle>Publish controls</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setConfirmPublish(true)}>Publish all products</Button>
          <Button variant="ghost" onClick={() => setConfirmPublish(false)}>Unpublish all products</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Default visible columns</SectionTitle>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Choose which columns appear by default in the Products table. Saved to this browser.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {ALL_COLS.map((c) => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Auto-refresh interval</SectionTitle>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>How often the Overview stats bar refreshes. Saved to this browser.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[[15000, '15s'], [30000, '30s'], [60000, '60s'], [0, 'Off']].map(([v, label]) => (
            <Button key={label} size="sm" variant={refresh === v ? 'primary' : 'ghost'} onClick={() => saveRefresh(v as number)}>{label}</Button>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <div style={{ border: `1px solid ${C.red}66`, borderRadius: 10, padding: 18, background: `${C.red}0d` }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.red, marginBottom: 14 }}>Danger zone</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>Clear all scraper run logs</p>
              <p style={{ fontSize: 12, color: C.muted }}>Truncates the scraper_runs table. Does not affect products.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmRuns(true)}>Clear logs</Button>
          </div>
          <div style={{ height: 1, background: `${C.red}33` }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>Delete ALL food products</p>
              <p style={{ fontSize: 12, color: C.muted }}>Permanently truncates the foods table. This cannot be undone.</p>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete all products</Button>
          </div>
        </div>
      </div>

      {/* Confirm modals */}
      <Modal open={confirmPublish !== null} onClose={() => setConfirmPublish(null)} title={confirmPublish ? 'Publish all products' : 'Unpublish all products'} width={440}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>
          {confirmPublish ? 'Make every product visible in the app?' : 'Hide every product from the app? Users will not be able to find any food until republished.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="ghost" onClick={() => setConfirmPublish(null)}>Cancel</Button>
          <Button variant={confirmPublish ? 'primary' : 'danger'} onClick={doPublish} disabled={busy === 'publish'}>{busy === 'publish' ? 'Working…' : 'Confirm'}</Button>
        </div>
      </Modal>

      <Modal open={confirmRuns} onClose={() => setConfirmRuns(false)} title="Clear scraper run logs" width={440}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>Permanently delete all scraper run history? This cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="ghost" onClick={() => setConfirmRuns(false)}>Cancel</Button>
          <Button variant="danger" onClick={doClearRuns} disabled={busy === 'runs'}>{busy === 'runs' ? 'Clearing…' : 'Clear logs'}</Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteText('') }} title="Delete ALL food products" width={480}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5, marginBottom: 14 }}>
          This permanently deletes <strong>every</strong> product in the foods table. The app's food search will be empty until the scraper repopulates it. Type <strong style={{ color: C.red }}>DELETE</strong> to unlock.
        </p>
        <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="Type DELETE" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="ghost" onClick={() => { setDeleteOpen(false); setDeleteText('') }}>Cancel</Button>
          <Button variant="danger" onClick={doDeleteAll} disabled={deleteText !== 'DELETE' || busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Delete all products'}</Button>
        </div>
      </Modal>
    </div>
  )
}
