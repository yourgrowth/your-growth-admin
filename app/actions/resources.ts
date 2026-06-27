'use server'

import { revalidatePath } from 'next/cache'
import { genericAdmin } from '@/lib/supabase/generic'
import { requireAdmin, audit } from './_admin'
import { getResourceConfig, type Field } from '@/lib/admin/resources'

export type Row = Record<string, unknown>
export type RefLabels = Record<string, string> // `${fieldKey}:${id}` -> label

export interface ListResult {
  rows: Row[]
  total: number
  refLabels: RefLabels
  error?: string
}

export interface ListOptions {
  page: number
  pageSize: number
  search?: string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  userId?: string
}

// --- value coercion ---------------------------------------------------------
function coerce(field: Field, raw: unknown): unknown {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') {
    return field.type === 'boolean' ? Boolean(raw) : null
  }
  switch (field.type) {
    case 'number': {
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === '1'
    case 'json':
    case 'array': {
      if (typeof raw !== 'string') return raw
      return JSON.parse(raw) // throws on invalid → caught by caller
    }
    default:
      return typeof raw === 'string' ? raw : String(raw)
  }
}

// --- reads ------------------------------------------------------------------
export async function listResource(table: string, opts: ListOptions): Promise<ListResult> {
  try {
    await requireAdmin()
    const cfg = getResourceConfig(table)
    if (!cfg) return { rows: [], total: 0, refLabels: {}, error: 'Unknown resource' }
    const admin = genericAdmin()

    let q = admin.from(table).select('*', { count: 'exact' })

    if (opts.userId && cfg.userScoped) q = q.eq('user_id', opts.userId)

    const search = opts.search?.trim()
    if (search && cfg.searchFields.length) {
      const safe = search.replace(/[,()*]/g, ' ').trim()
      const or = cfg.searchFields.map((f) => `${f}.ilike.%${safe}%`).join(',')
      q = q.or(or)
    }

    const sortKey = opts.sortKey ?? cfg.defaultSort.key
    const asc = (opts.sortDir ?? cfg.defaultSort.dir) === 'asc'
    const from = (opts.page - 1) * opts.pageSize

    // chain the transform ops (order/range) without reassigning `q` so the
    // builder type stays a filter builder above and we never mix builder types
    const { data, count, error } = await q
      .order(sortKey, { ascending: asc, nullsFirst: false })
      .range(from, from + opts.pageSize - 1)
    if (error) return { rows: [], total: 0, refLabels: {}, error: error.message }
    const rows = (data ?? []) as Row[]

    const refLabels = await resolveRefLabels(cfg.fields, rows)
    return { rows, total: count ?? 0, refLabels }
  } catch (e) {
    return { rows: [], total: 0, refLabels: {}, error: e instanceof Error ? e.message : 'Query failed' }
  }
}

async function resolveRefLabels(fields: Field[], rows: Row[]): Promise<RefLabels> {
  const out: RefLabels = {}
  const refFields = fields.filter((f) => f.type === 'ref' && f.ref)
  if (!refFields.length || !rows.length) return out
  const admin = genericAdmin()
  await Promise.all(
    refFields.map(async (f) => {
      const ids = [...new Set(rows.map((r) => r[f.key]).filter(Boolean))] as string[]
      if (!ids.length) return
      const sel = ['id', ...f.ref!.labelFields].join(',')
      const { data } = await admin.from(f.ref!.table).select(sel).in('id', ids)
      for (const rec of (data ?? []) as unknown as Row[]) {
        const label = f.ref!.labelFields.map((lf) => rec[lf]).find((v) => v) as string | undefined
        out[`${f.key}:${rec.id as string}`] = label ?? (rec.id as string)
      }
    }),
  )
  return out
}

/** Resolve labels for a free-form set of profile ids (used by user pickers). */
export async function searchProfiles(query: string): Promise<{ id: string; label: string }[]> {
  await requireAdmin()
  const admin = genericAdmin()
  let q = admin.from('profiles').select('id, display_name, email').limit(20)
  const s = query.trim()
  if (s) q = q.or(`display_name.ilike.%${s}%,email.ilike.%${s}%`)
  const { data } = await q
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id as string,
    label: (r.display_name as string) || (r.email as string) || (r.id as string),
  }))
}

// --- writes -----------------------------------------------------------------
export async function upsertResource(
  table: string,
  values: Record<string, unknown>,
  pkValue?: string,
): Promise<{ ok: boolean; error?: string; row?: Row }> {
  try {
    const adminId = await requireAdmin()
    const cfg = getResourceConfig(table)
    if (!cfg) return { ok: false, error: 'Unknown resource' }
    const admin = genericAdmin()

    const payload: Record<string, unknown> = {}
    for (const field of cfg.fields) {
      if (!field.editable) continue
      if (!(field.key in values)) continue
      try {
        const v = coerce(field, values[field.key])
        if (v !== undefined) payload[field.key] = v
      } catch {
        return { ok: false, error: `Invalid JSON in field "${field.label}"` }
      }
    }

    if (Object.keys(payload).length === 0) return { ok: false, error: 'No editable fields supplied' }

    let row: Row | null = null
    if (pkValue) {
      const { data, error } = await admin.from(table).update(payload).eq(cfg.primaryKey, pkValue).select('*').single()
      if (error) return { ok: false, error: error.message }
      row = data as Row
      await audit(adminId, `${table}_update`, { pk: pkValue, fields: Object.keys(payload) })
    } else {
      const { data, error } = await admin.from(table).insert(payload).select('*').single()
      if (error) return { ok: false, error: error.message }
      row = data as Row
      await audit(adminId, `${table}_create`, { fields: Object.keys(payload) })
    }
    revalidatePath(`/data/${table}`)
    return { ok: true, row: row ?? undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export async function deleteResource(table: string, pkValue: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const cfg = getResourceConfig(table)
    if (!cfg) return { ok: false, error: 'Unknown resource' }
    if (!cfg.deletable) return { ok: false, error: 'This resource cannot be deleted' }
    const admin = genericAdmin()
    const { error } = await admin.from(table).delete().eq(cfg.primaryKey, pkValue)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, `${table}_delete`, { pk: pkValue })
    revalidatePath(`/data/${table}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' }
  }
}

export async function bulkDeleteResource(table: string, pkValues: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const cfg = getResourceConfig(table)
    if (!cfg) return { ok: false, error: 'Unknown resource' }
    if (!cfg.deletable) return { ok: false, error: 'This resource cannot be deleted' }
    if (!pkValues.length) return { ok: true }
    const admin = genericAdmin()
    const { error } = await admin.from(table).delete().in(cfg.primaryKey, pkValues)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, `${table}_bulk_delete`, { count: pkValues.length })
    revalidatePath(`/data/${table}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' }
  }
}

/** Per-group + global counts for the Data Control hub. */
export async function getResourceCounts(tables: string[]): Promise<Record<string, number>> {
  await requireAdmin()
  const admin = genericAdmin()
  const out: Record<string, number> = {}
  await Promise.all(
    tables.map(async (t) => {
      try {
        const { count } = await admin.from(t).select('*', { count: 'exact', head: true })
        out[t] = count ?? 0
      } catch {
        out[t] = 0
      }
    }),
  )
  return out
}
