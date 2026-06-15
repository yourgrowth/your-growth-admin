import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyFoodFilters, parseFoodFilters } from '@/lib/foodFilters'
import type { Food } from '@/types/database'

const COLUMNS = [
  'id', 'barcode', 'name', 'brand', 'energy_kj', 'protein_g', 'fat_total_g',
  'fat_saturated_g', 'carbs_g', 'sugar_g', 'fibre_g', 'sodium_mg',
  'serving_size_g', 'source', 'image_url', 'is_published', 'flagged_for_review',
  'flag_reason', 'created_at',
] as const

function escape(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function toCSV(rows: Food[]): string {
  const header = COLUMNS.join(',')
  const body = rows.map((r) => COLUMNS.map((c) => escape((r as Record<string, unknown>)[c])).join(',')).join('\n')
  return `${header}\n${body}`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return new NextResponse('Forbidden', { status: 403 })

  const params = new URL(req.url).searchParams
  const filters = parseFoodFilters(params)
  const idsParam = params.get('ids') // explicit selection export

  const admin = createAdminClient()
  const rows: Food[] = []

  if (idsParam) {
    const ids = idsParam.split(',').filter(Boolean)
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await admin.from('foods').select('*').in('id', ids.slice(i, i + 500))
      rows.push(...((data ?? []) as Food[]))
    }
  } else {
    // page through all matching rows
    const pageSize = 1000
    for (let page = 0; page < 100; page++) {
      let q = admin.from('foods').select('*')
      q = applyFoodFilters(q as never, filters) as never
      q = q.order(filters.sortKey ?? 'created_at', { ascending: (filters.sortDir ?? 'desc') === 'asc' }) as never
      const { data } = await q.range(page * pageSize, page * pageSize + pageSize - 1)
      const batch = (data ?? []) as Food[]
      rows.push(...batch)
      if (batch.length < pageSize) break
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(toCSV(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="foods_export_${date}.csv"`,
    },
  })
}
