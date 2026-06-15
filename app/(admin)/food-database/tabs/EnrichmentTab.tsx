'use client'

import { useEffect, useState } from 'react'
import {
  getEnrichmentStatus, getReenrichBarcodes, clearNutritionCache, clearProductAnalyses,
  type EnrichmentStatus,
} from '@/app/actions/foodDatabase'
import { C, Card, SectionTitle, Button, Input, Modal, useToast, Skeleton } from '../_ui'

export default function EnrichmentTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ padding: '10px 14px', borderRadius: 8, background: `${C.blue}14`, border: `1px solid ${C.blue}44`, fontSize: 12.5, color: C.blue }}>
        These controls generate copy-paste commands to run locally — the admin panel does not run Python or Ollama itself.
      </div>
      <StatusCards />
      <ScriptGenerators />
      <CacheManagement />
    </div>
  )
}

function StatItem({ label, value, sub, color = C.text }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ borderRadius: 8, padding: 14, background: C.bg, border: `1px solid ${C.dim}` }}>
      <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

function StatusCards() {
  const [s, setS] = useState<EnrichmentStatus | null>(null)
  const load = () => { setS(null); getEnrichmentStatus().then(setS).catch(() => {}) }
  useEffect(load, [])
  const pct = (n: number) => (s && s.total > 0 ? Math.round((n / s.total) * 100) : 0)
  return (
    <Card>
      <SectionTitle action={<Button size="sm" variant="ghost" onClick={load}>↻ Refresh</Button>}>Enrichment status</SectionTitle>
      {!s ? <Skeleton height={120} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <StatItem label="Complete macros" value={s.macroComplete.toLocaleString()} sub={`${pct(s.macroComplete)}% of all`} color={C.green} />
          <StatItem label="Missing ≥1 macro" value={s.macroIncomplete.toLocaleString()} sub={`${pct(s.macroIncomplete)}% of all`} color={C.amber} />
          <StatItem label="No barcode" value={s.noBarcode.toLocaleString()} sub="can't cross-ref OFF" color={C.red} />
          <StatItem label="Barcode, no OFF data" value={s.barcodeNoOff.toLocaleString()} sub="source ollama/manual" color={C.purple} />
          <StatItem label="With additive analysis" value={s.withAnalysis.toLocaleString()} color={C.cyan} />
          <StatItem label="Without analysis" value={s.withoutAnalysis.toLocaleString()} color={C.muted} />
        </div>
      )}
    </Card>
  )
}

function ScriptGenerators() {
  const toast = useToast()
  const [script, setScript] = useState<{ title: string; code: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const genOff = async () => {
    setBusy('off')
    const barcodes = await getReenrichBarcodes('off')
    setBusy(null)
    if (!barcodes.length) { toast('No products need OFF re-enrichment', 'info'); return }
    const code = `import requests, time\n\n# ${barcodes.length} barcodes missing one or more core macros\nBARCODES = [\n${barcodes.map((b) => `    "${b}",`).join('\n')}\n]\n\nfor bc in BARCODES:\n    r = requests.get(f"https://world.openfoodfacts.org/api/v2/product/{bc}.json")\n    if r.status_code == 200 and r.json().get("status") == 1:\n        product = r.json()["product"]\n        # TODO: upsert product nutriments into your foods table\n        print("OK", bc, product.get("product_name"))\n    else:\n        print("MISS", bc)\n    time.sleep(0.2)\n`
    setScript({ title: `OFF re-enrichment · ${barcodes.length} barcodes`, code })
  }

  const genOllama = async () => {
    setBusy('ollama')
    const barcodes = await getReenrichBarcodes('ollama')
    setBusy(null)
    if (!barcodes.length) { toast('No Ollama re-run candidates', 'info'); return }
    const code = `# ${barcodes.length} ollama-sourced products still missing macros (have image_url)\n# Re-run your Ollama vision pipeline for just these barcodes.\nBARCODES = [\n${barcodes.map((b) => `    "${b}",`).join('\n')}\n]\n\nfor bc in BARCODES:\n    # row = fetch_food_by_barcode(bc)  -> has image_url\n    # result = run_ollama_vision(row["image_url"])\n    # upsert_macros(bc, result)\n    print("RERUN", bc)\n`
    setScript({ title: `Ollama re-run · ${barcodes.length} barcodes`, code })
  }

  return (
    <Card>
      <SectionTitle>Generate re-enrichment commands</SectionTitle>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="ghost" onClick={genOff} disabled={busy === 'off'}>{busy === 'off' ? 'Building…' : 'Generate OFF re-enrichment script'}</Button>
        <Button variant="ghost" onClick={genOllama} disabled={busy === 'ollama'}>{busy === 'ollama' ? 'Building…' : 'Generate Ollama re-run script'}</Button>
      </div>
      <Modal open={!!script} onClose={() => setScript(null)} title={script?.title ?? ''} width={720}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => { if (script) { navigator.clipboard.writeText(script.code); toast('Script copied') } }}>Copy script</Button>
        </div>
        <pre style={{ background: C.bg, border: `1px solid ${C.dim2}`, borderRadius: 8, padding: 14, fontSize: 12, color: C.cyan, overflowX: 'auto', maxHeight: 460, fontFamily: 'monospace' }}>{script?.code}</pre>
      </Modal>
    </Card>
  )
}

function CacheManagement() {
  const toast = useToast()
  const [nutBarcode, setNutBarcode] = useState('')
  const [paBarcode, setPaBarcode] = useState('')
  const [confirm, setConfirm] = useState<null | 'nutrition' | 'analyses'>(null)
  const [busy, setBusy] = useState(false)

  const clearOne = async (kind: 'nutrition' | 'analyses', bc: string) => {
    if (!bc.trim()) { toast('Enter a barcode', 'error'); return }
    const res = kind === 'nutrition' ? await clearNutritionCache(bc) : await clearProductAnalyses(bc)
    if (res.ok) { toast('Cleared'); if (kind === 'nutrition') setNutBarcode(''); else setPaBarcode('') } else toast(res.error ?? 'Failed', 'error')
  }

  const clearAll = async () => {
    if (!confirm) return
    setBusy(true)
    const res = confirm === 'nutrition' ? await clearNutritionCache() : await clearProductAnalyses()
    setBusy(false)
    setConfirm(null)
    if (res.ok) toast('Cache cleared'); else toast(res.error ?? 'Failed', 'error')
  }

  return (
    <Card>
      <SectionTitle>Cache management</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ borderRadius: 8, padding: 14, background: C.bg, border: `1px solid ${C.dim}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>nutrition_cache</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Input placeholder="barcode" value={nutBarcode} onChange={(e) => setNutBarcode(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => clearOne('nutrition', nutBarcode)}>Clear</Button>
          </div>
          <Button size="sm" variant="danger" onClick={() => setConfirm('nutrition')}>Clear all cache</Button>
        </div>
        <div style={{ borderRadius: 8, padding: 14, background: C.bg, border: `1px solid ${C.dim}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>product_analyses (E-codes)</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Input placeholder="barcode" value={paBarcode} onChange={(e) => setPaBarcode(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => clearOne('analyses', paBarcode)}>Clear</Button>
          </div>
          <Button size="sm" variant="danger" onClick={() => setConfirm('analyses')}>Clear all analyses</Button>
        </div>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Confirm cache clear" width={440}>
        <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>This will truncate <strong>{confirm === 'nutrition' ? 'nutrition_cache' : 'product_analyses'}</strong>. Cached data will be regenerated on demand. Continue?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={clearAll} disabled={busy}>{busy ? 'Clearing…' : 'Clear all'}</Button>
        </div>
      </Modal>
    </Card>
  )
}
