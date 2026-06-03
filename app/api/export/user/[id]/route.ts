import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return new NextResponse('Forbidden', { status: 403 })

  const admin = createAdminClient()

  const [
    { data: userProfile },
    { data: habits },
    { data: goals },
    { data: gardenerSummaries },
    { data: mealSuggestions },
    { data: journalEntries },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', id).single(),
    admin.from('habits').select('*').eq('user_id', id),
    admin.from('goals').select('*').eq('user_id', id),
    admin.from('gardener_summaries').select('*').eq('user_id', id),
    admin.from('meal_suggestions').select('*').eq('user_id', id),
    admin.from('journal_entries').select('*').eq('user_id', id),
  ])

  const habitIds = (habits ?? []).map((h) => h.id)
  const { data: habitCompletions } =
    habitIds.length > 0
      ? await admin.from('habit_completions').select('*').in('habit_id', habitIds)
      : { data: [] }

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: id,
    profile: userProfile,
    habits: habits ?? [],
    habit_completions: habitCompletions ?? [],
    goals: goals ?? [],
    gardener_summaries: gardenerSummaries ?? [],
    meal_suggestions: mealSuggestions ?? [],
    journal_entries: journalEntries ?? [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="user-${id}.json"`,
    },
  })
}
