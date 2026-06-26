'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyFoodFilters, COVERAGE_FIELDS, type FoodFilters } from '@/lib/foodFilters'
import type { Food, ScraperRun, ProductSubmission } from '@/types/database'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return user.id
}

async function audit(adminId: string, action: string, metadata: Record<string, unknown>) {
  try {
    const admin = createAdminClient()
    await admin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_user_id: null,
      metadata: metadata as never,
    })
  } catch {
    // audit logging is best-effort
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export type ProductsResult = { rows: Food[]; total: number; error?: string }

export async function queryProducts(filters: FoodFilters, page: number, pageSize: number): Promise<ProductsResult> {
  try {
    await requireAdmin()
    const admin = createAdminClient()
    let q = admin.from('foods').select('*', { count: 'exact' })
    q = applyFoodFilters(q as never, filters) as never
    const sortKey = filters.sortKey ?? 'created_at'
    const asc = (filters.sortDir ?? 'desc') === 'asc'
    q = q.order(sortKey, { ascending: asc, nullsFirst: false }) as never
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data, count, error } = await q.range(from, to)
    if (error) return { rows: [], total: 0, error: error.message }
    return { rows: (data ?? []) as Food[], total: count ?? 0 }
  } catch (e) {
    return { rows: [], total: 0, error: e instanceof Error ? e.message : 'Query failed' }
  }
}

export type OverviewStats = {
  total: number
  published: number
  unpublished: number
  sources: { source: string; count: number; pct: number }[]
  macroComplete: number
  macroCompletePct: number
  missingMacros: number
  hasImage: number
  hasImagePct: number
  additiveAnalyses: number
  nutritionCacheEntries: number
  lastAddedAt: string | null
}

export async function getOverviewStats(): Promise<OverviewStats> {
  await requireAdmin()
  const admin = createAdminClient()

  const countOf = async (build: (q: ReturnType<typeof admin.from>) => unknown): Promise<number> => {
    const base = admin.from('foods').select('*', { count: 'exact', head: true })
    const { count } = (await (build(base as never) as Promise<{ count: number | null }>)) ?? { count: 0 }
    return count ?? 0
  }

  const [
    total,
    published,
    macroComplete,
    hasImage,
    additiveAnalyses,
    nutritionCacheEntries,
    sourceRows,
    lastAdded,
  ] = await Promise.all([
    countOf((q) => q),
    countOf((q) => (q as { eq: (c: string, v: unknown) => unknown }).eq('is_published', true)),
    countOf((q) => (q as { not: (c: string, op: string, v: unknown) => { not: (c: string, op: string, v: unknown) => { not: (c: string, op: string, v: unknown) => { not: (c: string, op: string, v: unknown) => unknown } } } })
      .not('energy_kj', 'is', null)
      .not('protein_g', 'is', null)
      .not('carbs_g', 'is', null)
      .not('fat_total_g', 'is', null)),
    countOf((q) => (q as { not: (c: string, op: string, v: unknown) => unknown }).not('image_url', 'is', null)),
    Promise.resolve(admin.from('product_analyses').select('*', { count: 'exact', head: true })).then((r) => r.count ?? 0).catch(() => 0),
    Promise.resolve(admin.from('nutrition_cache').select('*', { count: 'exact', head: true })).then((r) => r.count ?? 0).catch(() => 0),
    Promise.resolve(admin.from('foods').select('source')).then((r) => (r.data ?? []) as { source: string | null }[]).catch(() => [] as { source: string | null }[]),
    Promise.resolve(admin.from('foods').select('created_at').order('created_at', { ascending: false }).limit(1)).then((r) => r.data?.[0]?.created_at ?? null).catch(() => null),
  ])

  const sourceCounts = new Map<string, number>()
  for (const r of sourceRows) {
    const key = r.source ?? 'unknown'
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1)
  }
  const sources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  return {
    total,
    published,
    unpublished: total - published,
    sources,
    macroComplete,
    macroCompletePct: total > 0 ? Math.round((macroComplete / total) * 100) : 0,
    missingMacros: total - macroComplete,
    hasImage,
    hasImagePct: total > 0 ? Math.round((hasImage / total) * 100) : 0,
    additiveAnalyses,
    nutritionCacheEntries,
    lastAddedAt: lastAdded,
  }
}

export async function getBrands(): Promise<string[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin.from('foods').select('brand').not('brand', 'is', null).limit(5000)
  const set = new Set<string>()
  for (const r of (data ?? []) as { brand: string | null }[]) {
    if (r.brand) set.add(r.brand)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export async function getScraperRuns(limit = 50): Promise<ScraperRun[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin.from('scraper_runs').select('*').order('started_at', { ascending: false }).limit(limit)
  return (data ?? []) as ScraperRun[]
}

// ---- Quality reads --------------------------------------------------------
export type CoverageRow = { field: string; populated: number; total: number; pct: number }

export async function getCoverage(): Promise<CoverageRow[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const fields = [...COVERAGE_FIELDS, 'image_url', 'barcode'] as const
  const { count: total } = await admin.from('foods').select('*', { count: 'exact', head: true })
  const t = total ?? 0
  const results = await Promise.all(
    fields.map(async (field) => {
      const { count } = await admin.from('foods').select('*', { count: 'exact', head: true }).not(field, 'is', null)
      const populated = count ?? 0
      return { field, populated, total: t, pct: t > 0 ? Math.round((populated / t) * 100) : 0 }
    })
  )
  return results
}

export type DuplicateGroup = { barcode: string; count: number; products: Food[] }

export async function getDuplicates(): Promise<DuplicateGroup[]> {
  await requireAdmin()
  const admin = createAdminClient()
  // Pull barcodes; group in JS (no SQL access from the admin panel).
  const { data } = await admin.from('foods').select('*').not('barcode', 'is', null).limit(20000)
  const byBarcode = new Map<string, Food[]>()
  for (const f of (data ?? []) as Food[]) {
    const bc = f.barcode!
    if (!byBarcode.has(bc)) byBarcode.set(bc, [])
    byBarcode.get(bc)!.push(f)
  }
  return [...byBarcode.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([barcode, products]) => ({ barcode, count: products.length, products }))
    .sort((a, b) => b.count - a.count)
}

export type OutlierRow = { id: string; name: string | null; barcode: string | null; field: string; value: string }

export async function getOutliers(): Promise<OutlierRow[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const out: OutlierRow[] = []
  const push = (rows: Food[] | null, field: string, fmt: (f: Food) => string) => {
    for (const f of rows ?? []) out.push({ id: f.id, name: f.name, barcode: f.barcode, field, value: fmt(f) })
  }
  const [protein, fat, carbs, energyHi, energyNeg, sodium, servingHi, servingLo, noName, noBarcode] = await Promise.all([
    admin.from('foods').select('*').gt('protein_g', 100).limit(500),
    admin.from('foods').select('*').gt('fat_total_g', 100).limit(500),
    admin.from('foods').select('*').gt('carbs_g', 100).limit(500),
    admin.from('foods').select('*').gt('energy_kj', 4000).limit(500),
    admin.from('foods').select('*').lt('energy_kj', 0).limit(500),
    admin.from('foods').select('*').gt('sodium_mg', 10000).limit(500),
    admin.from('foods').select('*').gt('serving_size_g', 2000).limit(500),
    admin.from('foods').select('*').lt('serving_size_g', 1).limit(500),
    admin.from('foods').select('*').or('name.is.null,name.eq.').limit(500),
    admin.from('foods').select('*').is('barcode', null).limit(500),
  ])
  push(protein.data as Food[], 'protein_g > 100', (f) => `${f.protein_g}`)
  push(fat.data as Food[], 'fat_total_g > 100', (f) => `${f.fat_total_g}`)
  push(carbs.data as Food[], 'carbs_g > 100', (f) => `${f.carbs_g}`)
  push(energyHi.data as Food[], 'energy_kj > 4000', (f) => `${f.energy_kj}`)
  push(energyNeg.data as Food[], 'energy_kj < 0', (f) => `${f.energy_kj}`)
  push(sodium.data as Food[], 'sodium_mg > 10000', (f) => `${f.sodium_mg}`)
  push(servingHi.data as Food[], 'serving_size_g > 2000', (f) => `${f.serving_size_g}`)
  push(servingLo.data as Food[], 'serving_size_g < 1', (f) => `${f.serving_size_g}`)
  push(noName.data as Food[], 'name empty', () => '(empty)')
  push(noBarcode.data as Food[], 'barcode null', () => '(null)')
  return out
}

export async function appSearchPreview(query: string): Promise<Food[]> {
  await requireAdmin()
  if (!query.trim()) return []
  const admin = createAdminClient()
  const s = query.replace(/[,()*%]/g, ' ').trim()
  const { data } = await admin
    .from('foods')
    .select('*')
    .or(`name.ilike.%${s}%,brand.ilike.%${s}%`)
    .eq('is_published', true)
    .limit(10)
  return (data ?? []) as Food[]
}

export type EnrichmentStatus = {
  macroComplete: number
  macroIncomplete: number
  noBarcode: number
  barcodeNoOff: number
  withAnalysis: number
  withoutAnalysis: number
  total: number
}

export async function getEnrichmentStatus(): Promise<EnrichmentStatus> {
  await requireAdmin()
  const admin = createAdminClient()
  const headCount = (build: (q: unknown) => unknown) =>
    (build(admin.from('foods').select('*', { count: 'exact', head: true })) as Promise<{ count: number | null }>).then((r) => r.count ?? 0)

  const [total, macroComplete, noBarcode, barcodeNoOff, analyses] = await Promise.all([
    headCount((q) => q),
    headCount((q) => (q as { not: (c: string, o: string, v: unknown) => { not: (c: string, o: string, v: unknown) => { not: (c: string, o: string, v: unknown) => { not: (c: string, o: string, v: unknown) => unknown } } } })
      .not('energy_kj', 'is', null).not('protein_g', 'is', null).not('carbs_g', 'is', null).not('fat_total_g', 'is', null)),
    headCount((q) => (q as { is: (c: string, v: unknown) => unknown }).is('barcode', null)),
    headCount((q) => (q as { not: (c: string, o: string, v: unknown) => { in: (c: string, v: string[]) => unknown } }).not('barcode', 'is', null).in('source', ['ollama', 'ollama_vision', 'manual'])),
    Promise.resolve(admin.from('product_analyses').select('*', { count: 'exact', head: true })).then((r) => r.count ?? 0).catch(() => 0),
  ])
  return {
    total,
    macroComplete,
    macroIncomplete: total - macroComplete,
    noBarcode,
    barcodeNoOff,
    withAnalysis: analyses,
    withoutAnalysis: Math.max(0, total - analyses),
  }
}

export async function getReenrichBarcodes(kind: 'off' | 'ollama'): Promise<string[]> {
  await requireAdmin()
  const admin = createAdminClient()
  let q = admin.from('foods').select('barcode').not('barcode', 'is', null)
    .or('energy_kj.is.null,protein_g.is.null,carbs_g.is.null,fat_total_g.is.null')
  if (kind === 'ollama') {
    q = q.in('source', ['ollama', 'ollama_vision']).not('image_url', 'is', null)
  }
  const { data } = await q.limit(5000)
  return [...new Set(((data ?? []) as { barcode: string | null }[]).map((r) => r.barcode!).filter(Boolean))]
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export type ProductInput = Partial<Food> & { barcode: string }

export async function upsertProduct(input: ProductInput): Promise<{ ok: boolean; error?: string; row?: Food }> {
  try {
    const adminId = await requireAdmin()
    if (!input.barcode || !input.barcode.trim()) return { ok: false, error: 'Barcode is required' }
    const admin = createAdminClient()
    const { id, created_at, ...rest } = input as Record<string, unknown>
    void created_at
    let row: Food | null = null
    if (id) {
      const { data, error } = await admin.from('foods').update(rest as never).eq('id', id as string).select('*').single()
      if (error) return { ok: false, error: error.message }
      row = data as Food
    } else {
      const { data, error } = await admin.from('foods').upsert(rest as never, { onConflict: 'barcode' }).select('*').single()
      if (error) return { ok: false, error: error.message }
      row = data as Food
    }
    await audit(adminId, id ? 'food_update' : 'food_create', { barcode: input.barcode })
    revalidatePath('/food-database')
    return { ok: true, row: row ?? undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export async function deleteProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'food_delete', { id })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' }
  }
}

export async function bulkDelete(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods').delete().in('id', ids)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'food_bulk_delete', { count: ids.length })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' }
  }
}

export async function bulkSetPublished(ids: string[], value: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods').update({ is_published: value }).in('id', ids)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, value ? 'food_bulk_publish' : 'food_bulk_unpublish', { count: ids.length })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' }
  }
}

export async function bulkFlag(ids: string[], reason = 'Bulk flagged for review'): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods').update({ flagged_for_review: true, flag_reason: reason }).in('id', ids)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'food_bulk_flag', { count: ids.length })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' }
  }
}

export async function setPublished(id: string, value: boolean): Promise<{ ok: boolean; error?: string }> {
  return bulkSetPublished([id], value)
}

export async function setFlag(id: string, value: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods')
      .update({ flagged_for_review: value, flag_reason: value ? (reason ?? 'Flagged for review') : null })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, value ? 'food_flag' : 'food_unflag', { id })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' }
  }
}

export async function logScraperRun(input: Partial<ScraperRun>): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const { error } = await admin.from('scraper_runs').insert({
      started_at: input.started_at ?? now,
      completed_at: input.status === 'running' ? null : (input.completed_at ?? now),
      status: input.status ?? 'completed',
      products_scraped: input.products_scraped ?? 0,
      off_hits: input.off_hits ?? 0,
      ollama_hits: input.ollama_hits ?? 0,
      misses: input.misses ?? 0,
      errors: input.errors ?? 0,
      source: input.source ?? 'all',
      notes: input.notes ?? null,
    })
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'scraper_run_logged', { source: input.source })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Log failed' }
  }
}

// ---- Duplicate resolution -------------------------------------------------
export async function resolveDuplicateKeep(keepId: string, deleteIds: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods').delete().in('id', deleteIds)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'food_dup_resolve', { keepId, removed: deleteIds.length })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Resolve failed' }
  }
}

export async function mergeDuplicates(keepId: string, merged: Partial<Food>, deleteIds: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { id, created_at, ...rest } = merged as Record<string, unknown>
    void id; void created_at
    const { error: upErr } = await admin.from('foods').update(rest as never).eq('id', keepId)
    if (upErr) return { ok: false, error: upErr.message }
    if (deleteIds.length) {
      const { error: delErr } = await admin.from('foods').delete().in('id', deleteIds)
      if (delErr) return { ok: false, error: delErr.message }
    }
    await audit(adminId, 'food_dup_merge', { keepId, removed: deleteIds.length })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Merge failed' }
  }
}

// ---- Import ---------------------------------------------------------------
export type ImportSummary = { inserted: number; updated: number; skipped: number; error?: string }

export async function importProducts(rows: Record<string, unknown>[]): Promise<ImportSummary> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    let inserted = 0
    let updated = 0
    let skipped = 0

    const numeric = new Set(['energy_kj', 'protein_g', 'fat_total_g', 'fat_saturated_g', 'carbs_g', 'sugar_g', 'fibre_g', 'sodium_mg', 'serving_size_g'])
    const allowed = new Set([...numeric, 'barcode', 'name', 'brand', 'source', 'image_url', 'is_published', 'flagged_for_review', 'flag_reason'])

    const toUpsert: Record<string, unknown>[] = []
    const existingBarcodes = new Set<string>()
    const barcodes = rows.map((r) => String(r.barcode ?? '').trim()).filter(Boolean)
    if (barcodes.length) {
      // chunk the existence check to avoid huge IN()
      for (let i = 0; i < barcodes.length; i += 500) {
        const chunk = barcodes.slice(i, i + 500)
        const { data } = await admin.from('foods').select('barcode').in('barcode', chunk)
        for (const r of (data ?? []) as { barcode: string | null }[]) if (r.barcode) existingBarcodes.add(r.barcode)
      }
    }

    for (const raw of rows) {
      const barcode = String(raw.barcode ?? '').trim()
      if (!barcode) { skipped++; continue }
      const clean: Record<string, unknown> = { barcode }
      for (const [k, v] of Object.entries(raw)) {
        if (!allowed.has(k) || k === 'barcode') continue
        if (v === '' || v === null || v === undefined) continue
        if (numeric.has(k)) { const n = Number(v); if (!Number.isNaN(n)) clean[k] = n }
        else if (k === 'is_published' || k === 'flagged_for_review') clean[k] = v === true || v === 'true' || v === '1'
        else clean[k] = v
      }
      toUpsert.push(clean)
      if (existingBarcodes.has(barcode)) updated++; else inserted++
    }

    for (let i = 0; i < toUpsert.length; i += 500) {
      const chunk = toUpsert.slice(i, i + 500)
      const { error } = await admin.from('foods').upsert(chunk as never, { onConflict: 'barcode' })
      if (error) return { inserted, updated, skipped, error: error.message }
    }

    await audit(adminId, 'food_import', { inserted, updated, skipped })
    revalidatePath('/food-database')
    return { inserted, updated, skipped }
  } catch (e) {
    return { inserted: 0, updated: 0, skipped: 0, error: e instanceof Error ? e.message : 'Import failed' }
  }
}

// ---- Cache management -----------------------------------------------------
export async function clearNutritionCache(barcode?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const q = admin.from('nutrition_cache').delete()
    const { error } = barcode ? await q.eq('barcode', barcode) : await q.not('id', 'is', null)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'nutrition_cache_clear', { barcode: barcode ?? 'all' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Clear failed' }
  }
}

export async function clearProductAnalyses(barcode?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const q = admin.from('product_analyses').delete()
    const { error } = barcode ? await q.eq('barcode', barcode) : await q.not('id', 'is', null)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'product_analyses_clear', { barcode: barcode ?? 'all' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Clear failed' }
  }
}

// ---- Settings / danger zone ----------------------------------------------
export async function setAllPublished(value: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('foods').update({ is_published: value }).not('id', 'is', null)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, value ? 'food_publish_all' : 'food_unpublish_all', {})
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' }
  }
}

export async function clearScraperRuns(): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error } = await admin.from('scraper_runs').delete().not('id', 'is', null)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'scraper_runs_clear', {})
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Clear failed' }
  }
}

// ---------------------------------------------------------------------------
// User-submitted products (Add Missing Product by Photo)
// ---------------------------------------------------------------------------
export type SubmissionWithProduct = { submission: ProductSubmission; product: Food | null }
export type SubmissionStatusFilter = 'pending' | 'approved' | 'rejected' | 'all'

export async function getPendingSubmissionCount(): Promise<number> {
  try {
    await requireAdmin()
    const admin = createAdminClient()
    const { count } = await admin
      .from('product_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    return count ?? 0
  } catch {
    return 0
  }
}

export async function listSubmissions(status: SubmissionStatusFilter = 'pending'): Promise<SubmissionWithProduct[]> {
  await requireAdmin()
  const admin = createAdminClient()
  let q = admin.from('product_submissions').select('*').order('created_at', { ascending: false }).limit(200)
  if (status !== 'all') q = q.eq('status', status)
  const { data } = await q
  const submissions = (data ?? []) as ProductSubmission[]
  if (submissions.length === 0) return []

  const productIds = [...new Set(submissions.map((s) => s.product_id).filter(Boolean))] as string[]
  const productsById = new Map<string, Food>()
  if (productIds.length) {
    const { data: foods } = await admin.from('foods').select('*').in('id', productIds)
    for (const f of (foods ?? []) as Food[]) productsById.set(f.id, f)
  }
  return submissions.map((submission) => ({
    submission,
    product: submission.product_id ? productsById.get(submission.product_id) ?? null : null,
  }))
}

export async function getSubmissionSignedUrls(
  frontPath: string,
  backPath: string,
): Promise<{ front: string | null; back: string | null; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()
    const [f, b] = await Promise.all([
      admin.storage.from('product-submissions').createSignedUrl(frontPath, 3600),
      admin.storage.from('product-submissions').createSignedUrl(backPath, 3600),
    ])
    return { front: f.data?.signedUrl ?? null, back: b.data?.signedUrl ?? null }
  } catch (e) {
    return { front: null, back: null, error: e instanceof Error ? e.message : 'Could not sign image URLs' }
  }
}

export async function approveSubmission(
  submissionId: string,
  productId: string,
  edits: Partial<Food>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { id, created_at, submitted_by, submission_id, ...rest } = edits as Record<string, unknown>
    void id; void created_at; void submitted_by; void submission_id
    // Write the admin's corrections, then publish + approve so it goes global.
    const { error: upErr } = await admin
      .from('foods')
      .update({ ...rest, verification_status: 'approved', is_published: true, flagged_for_review: false } as never)
      .eq('id', productId)
    if (upErr) return { ok: false, error: upErr.message }

    const { error: subErr } = await admin
      .from('product_submissions')
      .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
    if (subErr) return { ok: false, error: subErr.message }

    await audit(adminId, 'product_submission_approve', { submissionId, productId })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Approve failed' }
  }
}

export async function rejectSubmission(
  submissionId: string,
  productId: string | null,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    const admin = createAdminClient()
    const { error: subErr } = await admin
      .from('product_submissions')
      .update({ status: 'rejected', reject_reason: reason || null, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
    if (subErr) return { ok: false, error: subErr.message }

    // Soft reject: keep the foods row for audit but mark it rejected + unpublished
    // so it vanishes from the submitter's search.
    if (productId) {
      const { error: upErr } = await admin
        .from('foods')
        .update({ verification_status: 'rejected', is_published: false } as never)
        .eq('id', productId)
      if (upErr) return { ok: false, error: upErr.message }
    }

    await audit(adminId, 'product_submission_reject', { submissionId, productId, reason })
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Reject failed' }
  }
}

export async function deleteAllFoods(confirm: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()
    if (confirm !== 'DELETE') return { ok: false, error: 'Confirmation text did not match' }
    const admin = createAdminClient()
    const { error } = await admin.from('foods').delete().not('id', 'is', null)
    if (error) return { ok: false, error: error.message }
    await audit(adminId, 'food_delete_all', {})
    revalidatePath('/food-database')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' }
  }
}
