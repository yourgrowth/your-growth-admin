'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listSubmissions, getSubmissionSignedUrls, approveSubmission, rejectSubmission,
  type SubmissionWithProduct, type SubmissionStatusFilter,
} from '@/app/actions/foodDatabase'
import type { Food } from '@/types/database'
import { C, Card, Pill, Button, Input, Modal, useToast, Skeleton, EmptyState, relativeTime } from '../_ui'

const STATUSES: [SubmissionStatusFilter, string][] = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
]

// Editable foods columns + the extracted confidence keys that back each one.
type FieldType = 'text' | 'num'
const FORM_FIELDS: { key: keyof Food; label: string; type: FieldType; conf: string[] }[] = [
  { key: 'name', label: 'Name', type: 'text', conf: ['name'] },
  { key: 'brand', label: 'Brand', type: 'text', conf: ['brand'] },
  { key: 'barcode', label: 'Barcode', type: 'text', conf: ['barcode'] },
  { key: 'serving_size_g', label: 'Serving size (g)', type: 'num', conf: ['serving_size', 'servings_per_pack'] },
  { key: 'energy_kj', label: 'Energy kJ /100g', type: 'num', conf: ['per_100g.energy_kj', 'per_serving.energy_kj', 'energy_kj'] },
  { key: 'energy_kcal', label: 'Energy kcal /100g', type: 'num', conf: ['per_100g.energy_kcal', 'per_serving.energy_kcal', 'energy_kcal'] },
  { key: 'protein_g', label: 'Protein g /100g', type: 'num', conf: ['per_100g.protein_g', 'per_serving.protein_g', 'protein_g'] },
  { key: 'carbs_g', label: 'Carbs g /100g', type: 'num', conf: ['per_100g.carbs_g', 'per_serving.carbs_g', 'carbs_g'] },
  { key: 'fat_total_g', label: 'Fat g /100g', type: 'num', conf: ['per_100g.fat_g', 'per_serving.fat_g', 'fat_g'] },
  { key: 'fat_saturated_g', label: 'Sat fat g /100g', type: 'num', conf: ['per_100g.sat_fat_g'] },
  { key: 'sugar_g', label: 'Sugar g /100g', type: 'num', conf: ['per_100g.sugars_g'] },
  { key: 'fibre_total_g', label: 'Fibre g /100g', type: 'num', conf: ['per_100g.fibre_g'] },
  { key: 'sodium_mg', label: 'Sodium mg /100g', type: 'num', conf: ['per_100g.sodium_mg'] },
  { key: 'ingredients', label: 'Ingredients', type: 'text', conf: ['ingredients'] },
]

const MIN_CONFIDENCE = 0.55

function statusColor(status: string) {
  return status === 'approved' ? C.green : status === 'rejected' ? C.red : C.amber
}

function confidenceFor(extracted: unknown, keys: string[]): number | null {
  const conf = (extracted as { confidence?: Record<string, number> } | null)?.confidence
  if (!conf) return null
  const vals = keys.map((k) => conf[k]).filter((v): v is number => typeof v === 'number')
  return vals.length ? Math.min(...vals) : null
}

export default function SubmissionsTab() {
  const toast = useToast()
  const [status, setStatus] = useState<SubmissionStatusFilter>('pending')
  const [rows, setRows] = useState<SubmissionWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<SubmissionWithProduct | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listSubmissions(status)
      setRows(data)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load submissions', 'error')
    } finally {
      setLoading(false)
    }
  }, [status, toast])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>User-submitted products from the app (photo of front + back).</span>
        <div style={{ flex: 1 }} />
        {STATUSES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            style={{
              padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: status === key ? `${C.green}22` : 'transparent',
              color: status === key ? C.green : C.muted,
              border: `1px solid ${status === key ? C.green + '66' : C.dim2}`,
            }}
          >
            {label}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.dim}`, background: C.surface }}>
                {['Product', 'Brand', 'Barcode', 'Status', 'Submitted', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td colSpan={6} style={{ padding: '10px 12px' }}><Skeleton height={20} /></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="No submissions" hint={status === 'pending' ? 'No products are waiting for review.' : 'Nothing here for this filter.'} /></td></tr>
              )}
              {!loading && rows.map(({ submission, product }) => (
                <tr key={submission.id} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: '10px 12px', color: C.text, fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {submission.name ?? product?.name ?? <span style={{ color: C.red }}>(no name)</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: C.muted }}>{submission.brand ?? product?.brand ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: C.muted, fontFamily: 'monospace' }}>{submission.barcode ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}><Pill color={statusColor(submission.status)}>{submission.status}</Pill></td>
                  <td style={{ padding: '10px 12px', color: C.muted }}>{relativeTime(submission.created_at)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <Button size="sm" variant="primary" onClick={() => setActive({ submission, product })}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {active && (
        <ReviewModal
          row={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); load() }}
        />
      )}
    </div>
  )
}

function ReviewModal({ row, onClose, onDone }: { row: SubmissionWithProduct; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const { submission, product } = row
  const [images, setImages] = useState<{ front: string | null; back: string | null }>({ front: null, back: null })
  const [zoom, setZoom] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const [form, setForm] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {}
    for (const f of FORM_FIELDS) {
      const v = product ? (product[f.key] as unknown) : null
      base[f.key as string] = v == null ? '' : String(v)
    }
    return base
  })
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))

  useEffect(() => {
    getSubmissionSignedUrls(submission.front_image_path, submission.back_image_path)
      .then((r) => { setImages({ front: r.front, back: r.back }); if (r.error) toast(r.error, 'error') })
  }, [submission.front_image_path, submission.back_image_path, toast])

  const editsFromForm = (): Partial<Food> => {
    const out: Record<string, unknown> = {}
    for (const f of FORM_FIELDS) {
      const raw = form[f.key as string]
      if (f.type === 'num') out[f.key as string] = raw === '' ? null : Number(raw)
      else out[f.key as string] = raw === '' ? null : raw
    }
    return out as Partial<Food>
  }

  const approve = async () => {
    if (!product?.id) { toast('No linked product row to approve', 'error'); return }
    if (!String(form.name).trim()) { toast('Name is required', 'error'); return }
    setBusy(true)
    const res = await approveSubmission(submission.id, product.id, editsFromForm())
    setBusy(false)
    if (res.ok) { toast('Approved — now live in search'); onDone() }
    else toast(res.error ?? 'Approve failed', 'error')
  }

  const reject = async () => {
    setBusy(true)
    const res = await rejectSubmission(submission.id, product?.id ?? null, reason)
    setBusy(false)
    if (res.ok) { toast('Rejected'); onDone() }
    else toast(res.error ?? 'Reject failed', 'error')
  }

  return (
    <Modal open onClose={onClose} title="Review submission" width={860}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Images */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['front', 'back'] as const).map((slot) => (
            <div key={slot}>
              <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase' }}>{slot} of pack</p>
              {images[slot] ? (
                <img
                  src={images[slot]!} alt={slot}
                  onClick={() => setZoom(images[slot])}
                  style={{ width: '100%', borderRadius: 10, border: `1px solid ${C.dim2}`, cursor: 'zoom-in', maxHeight: 280, objectFit: 'contain', background: C.bg }}
                />
              ) : (
                <Skeleton height={200} />
              )}
            </div>
          ))}
        </div>

        {/* Editable form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 580, overflowY: 'auto', paddingRight: 4 }}>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Correct any misread values before approving. Fields the model was unsure about are marked
            <span style={{ color: C.amber }}> low confidence</span>.
          </p>
          {FORM_FIELDS.map((f) => {
            const conf = confidenceFor(submission.extracted, f.conf)
            const low = conf != null && conf < MIN_CONFIDENCE
            return (
              <label key={f.key as string} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: low ? C.amber : C.muted, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.label}</span>
                  {conf != null && <span style={{ color: low ? C.amber : C.muted2 }}>{Math.round(conf * 100)}%{low ? ' · low' : ''}</span>}
                </span>
                <Input
                  type={f.type === 'num' ? 'number' : 'text'}
                  value={form[f.key as string]}
                  onChange={(e) => set(f.key as string, e.target.value)}
                  style={low ? { borderColor: `${C.amber}88` } : undefined}
                />
              </label>
            )
          })}
        </div>
      </div>

      {submission.status === 'pending' ? (
        rejecting ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: `1px solid ${C.red}55`, background: `${C.red}12` }}>
            <p style={{ fontSize: 12.5, color: C.text, marginBottom: 8 }}>Reject this submission? It disappears from the submitter’s search.</p>
            <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button variant="danger" onClick={reject} disabled={busy}>{busy ? 'Rejecting…' : 'Confirm reject'}</Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
            <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Reject</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={approve} disabled={busy}>{busy ? 'Approving…' : 'Approve & publish'}</Button>
            </div>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          {submission.status === 'rejected' && submission.reject_reason && (
            <span style={{ fontSize: 12.5, color: C.muted, alignSelf: 'center', marginRight: 'auto' }}>Reason: {submission.reject_reason}</span>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <img src={zoom} alt="" style={{ maxWidth: '92%', maxHeight: '92%', borderRadius: 12 }} />
        </div>
      )}
    </Modal>
  )
}
