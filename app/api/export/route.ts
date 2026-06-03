import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return new NextResponse('Forbidden', { status: 403 })

  const table = new URL(req.url).searchParams.get('table')
  const admin = createAdminClient()

  type TableRow = Record<string, unknown>
  let rows: TableRow[] = []
  let filename = 'export.csv'

  if (table === 'users') {
    const { data } = await admin.from('profiles').select('*').order('created_at', { ascending: false })
    rows = (data ?? []) as TableRow[]
    filename = 'users.csv'
  } else if (table === 'habits') {
    const { data } = await admin.from('habits').select('*').order('created_at', { ascending: false })
    rows = (data ?? []) as TableRow[]
    filename = 'habits.csv'
  } else if (table === 'goals') {
    const { data } = await admin.from('goals').select('*').order('created_at', { ascending: false })
    rows = (data ?? []) as TableRow[]
    filename = 'goals.csv'
  } else if (table === 'gardener') {
    const { data } = await admin.from('gardener_summaries').select('*').order('created_at', { ascending: false })
    rows = (data ?? []) as TableRow[]
    filename = 'gardener_summaries.csv'
  } else if (table === 'nutrition') {
    const { data } = await admin.from('meal_suggestions').select('*').order('created_at', { ascending: false })
    rows = (data ?? []) as TableRow[]
    filename = 'nutrition.csv'
  } else {
    return new NextResponse('Invalid table', { status: 400 })
  }

  return new NextResponse(toCSV(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
