// Shared filter logic for the foods table, used by both the queryProducts
// server action and the CSV export API route so the export honours the exact
// same filters as the on-screen table.

export type FoodSortKey =
  | 'name'
  | 'brand'
  | 'barcode'
  | 'energy_kj'
  | 'protein_g'
  | 'carbs_g'
  | 'fat_total_g'
  | 'source'
  | 'is_published'
  | 'flagged_for_review'
  | 'created_at'

export type FoodStatus = 'all' | 'published' | 'unpublished' | 'flagged'

export type NutrientRange = { min?: number | null; max?: number | null }

export type FoodFilters = {
  search?: string
  sources?: string[]            // source values to include
  brand?: string                // exact brand
  status?: FoodStatus
  missingMacros?: boolean        // only rows where any core macro is null
  missingImage?: boolean         // only rows with no image_url
  dateFrom?: string | null       // created_at >=
  dateTo?: string | null         // created_at <=
  ranges?: Partial<Record<'energy_kj' | 'protein_g' | 'carbs_g' | 'fat_total_g' | 'fibre_g' | 'sodium_mg', NutrientRange>>
  sortKey?: FoodSortKey
  sortDir?: 'asc' | 'desc'
}

const RANGE_FIELDS = ['energy_kj', 'protein_g', 'carbs_g', 'fat_total_g', 'fibre_g', 'sodium_mg'] as const

// A loose type for the chainable PostgREST builder — we only use a handful of
// methods and don't want to depend on the full generated builder type here.
type Filterable = {
  or: (f: string) => Filterable
  in: (col: string, vals: string[]) => Filterable
  eq: (col: string, val: unknown) => Filterable
  is: (col: string, val: unknown) => Filterable
  gte: (col: string, val: unknown) => Filterable
  lte: (col: string, val: unknown) => Filterable
}

function escapeLike(s: string): string {
  // PostgREST splits on commas inside .or(); strip them and other special chars
  return s.replace(/[,()*%]/g, ' ').trim()
}

export function applyFoodFilters<T extends Filterable>(query: T, f: FoodFilters): T {
  let q = query

  if (f.search && f.search.trim().length > 0) {
    const s = escapeLike(f.search)
    if (s) q = q.or(`name.ilike.%${s}%,brand.ilike.%${s}%,barcode.ilike.%${s}%`) as T
  }

  if (f.sources && f.sources.length > 0) {
    q = q.in('source', f.sources) as T
  }

  if (f.brand && f.brand.trim().length > 0) {
    q = q.eq('brand', f.brand) as T
  }

  if (f.status === 'published') q = q.eq('is_published', true) as T
  else if (f.status === 'unpublished') q = q.eq('is_published', false) as T
  else if (f.status === 'flagged') q = q.eq('flagged_for_review', true) as T

  if (f.missingMacros) {
    q = q.or('energy_kj.is.null,protein_g.is.null,carbs_g.is.null,fat_total_g.is.null') as T
  }

  if (f.missingImage) {
    q = q.is('image_url', null) as T
  }

  if (f.dateFrom) q = q.gte('created_at', f.dateFrom) as T
  if (f.dateTo) q = q.lte('created_at', f.dateTo) as T

  if (f.ranges) {
    for (const field of RANGE_FIELDS) {
      const r = f.ranges[field]
      if (!r) continue
      if (r.min !== null && r.min !== undefined && !Number.isNaN(r.min)) q = q.gte(field, r.min) as T
      if (r.max !== null && r.max !== undefined && !Number.isNaN(r.max)) q = q.lte(field, r.max) as T
    }
  }

  return q
}

// Build FoodFilters from URL search params (used by the export route + to keep
// the Products tab bookmarkable).
export function parseFoodFilters(params: URLSearchParams): FoodFilters {
  const num = (v: string | null) => (v === null || v === '' ? undefined : Number(v))
  const ranges: FoodFilters['ranges'] = {}
  for (const field of RANGE_FIELDS) {
    const min = num(params.get(`${field}_min`))
    const max = num(params.get(`${field}_max`))
    if (min !== undefined || max !== undefined) ranges[field] = { min, max }
  }
  return {
    search: params.get('q') ?? undefined,
    sources: params.get('sources') ? params.get('sources')!.split(',').filter(Boolean) : undefined,
    brand: params.get('brand') ?? undefined,
    status: (params.get('status') as FoodStatus) ?? 'all',
    missingMacros: params.get('missingMacros') === '1',
    missingImage: params.get('missingImage') === '1',
    dateFrom: params.get('dateFrom') || null,
    dateTo: params.get('dateTo') || null,
    ranges: Object.keys(ranges).length ? ranges : undefined,
    sortKey: (params.get('sortKey') as FoodSortKey) ?? 'created_at',
    sortDir: (params.get('sortDir') as 'asc' | 'desc') ?? 'desc',
  }
}

// The 9 nutrition fields used for the completeness ("Cover %") indicator.
export const COVERAGE_FIELDS = [
  'energy_kj',
  'protein_g',
  'fat_total_g',
  'fat_saturated_g',
  'carbs_g',
  'sugar_g',
  'fibre_g',
  'sodium_mg',
  'serving_size_g',
] as const

export function coveragePct(food: Record<string, unknown>): number {
  let filled = 0
  for (const field of COVERAGE_FIELDS) {
    if (food[field] !== null && food[field] !== undefined) filled++
  }
  return Math.round((filled / COVERAGE_FIELDS.length) * 100)
}
