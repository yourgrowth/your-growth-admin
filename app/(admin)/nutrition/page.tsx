import { createClient } from '@/lib/supabase/server'
import NutritionClient, { type MealWithUser } from './NutritionClient'

export default async function NutritionPage() {
  const supabase = await createClient()

  const { data: meals } = await supabase
    .from('meal_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  const userIds = [...new Set((meals ?? []).map((m) => m.user_id))]
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const mealsWithUser: MealWithUser[] = (meals ?? []).map((m) => ({
    ...m,
    user_name: profileMap.get(m.user_id) ?? null,
  }))

  return <NutritionClient meals={mealsWithUser} />
}
