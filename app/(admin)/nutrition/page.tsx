import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NutritionClient, { type MealWithUser } from './NutritionClient'

export type AiUsageStats = {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  estimatedCost: number
  foodAnalysisCalls: number
  mealSuggestionCalls: number
  avgDurationMs: number
  errorRate: number
}

export type ProductAnalysisStats = {
  totalAnalysed: number
  cacheHitRate: number
  avgRisk: string
}

export type FoodQualityStats = {
  avgQualityScore: number
  totalLogs: number
  highAdditivePct: number
  wholeFoodPct: number
}

export default async function NutritionPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: meals },
    aiUsageResult,
    productAnalysisResult,
    nutritionCacheResult,
    foodQualityResult,
  ] = await Promise.all([
    supabase.from('meal_suggestions').select('*').order('created_at', { ascending: false }),
    Promise.resolve(admin.from('ai_usage_log').select('feature, input_tokens, output_tokens, duration_ms, error, created_at').gte('created_at', thirtyDaysAgo)).catch(() => ({ data: null })),
    Promise.resolve(admin.from('product_analyses').select('overall_risk')).catch(() => ({ data: null })),
    Promise.resolve(admin.from('nutrition_cache').select('completeness')).catch(() => ({ data: null })),
    Promise.resolve(admin.from('food_quality_logs').select('quality_score, high_additive_count, whole_food_count').gte('created_at', thirtyDaysAgo)).catch(() => ({ data: null })),
  ])

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

  // AI usage stats
  type UsageRow = { feature: string | null; input_tokens: number | null; output_tokens: number | null; duration_ms: number | null; error: string | null }
  const usageRows = ((aiUsageResult as { data: UsageRow[] | null }).data ?? [])
  const nutritionUsage = usageRows.filter((r) => ['food_analysis', 'meal_suggestions', 'analyse-food-image', 'parse-voice-food'].includes(r.feature ?? ''))
  const totalInputTokens = nutritionUsage.reduce((s, r) => s + (r.input_tokens ?? 0), 0)
  const totalOutputTokens = nutritionUsage.reduce((s, r) => s + (r.output_tokens ?? 0), 0)
  const estimatedCost = (totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000
  const durations = nutritionUsage.map((r) => r.duration_ms ?? 0).filter((v) => v > 0)
  const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
  const errorCount = nutritionUsage.filter((r) => r.error != null).length
  const errorRate = nutritionUsage.length > 0 ? Math.round((errorCount / nutritionUsage.length) * 100) : 0

  const aiUsageStats: AiUsageStats = {
    totalCalls: nutritionUsage.length,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost,
    foodAnalysisCalls: nutritionUsage.filter((r) => ['food_analysis', 'analyse-food-image'].includes(r.feature ?? '')).length,
    mealSuggestionCalls: nutritionUsage.filter((r) => r.feature === 'meal_suggestions').length,
    avgDurationMs,
    errorRate,
  }

  // Product analysis stats
  type PaRow = { overall_risk: string | null }
  const paRows = ((productAnalysisResult as { data: PaRow[] | null }).data ?? [])
  const highRiskCount = paRows.filter((r) => r.overall_risk === 'high').length
  const productAnalysisStats: ProductAnalysisStats = {
    totalAnalysed: paRows.length,
    cacheHitRate: 0,
    avgRisk: paRows.length > 0 ? (highRiskCount > paRows.length * 0.2 ? 'Moderate' : 'Low') : '—',
  }

  type CacheRow = { completeness: number | null }
  const cacheRows = ((nutritionCacheResult as { data: CacheRow[] | null }).data ?? [])
  const avgCompleteness = cacheRows.length > 0
    ? Math.round(cacheRows.reduce((s, r) => s + (r.completeness ?? 0), 0) / cacheRows.length)
    : 0
  productAnalysisStats.cacheHitRate = avgCompleteness

  // Food quality stats
  type FqRow = { quality_score: number | null; high_additive_count: number | null; whole_food_count: number | null }
  const fqRows = ((foodQualityResult as { data: FqRow[] | null }).data ?? [])
  const avgQualityScore = fqRows.length > 0
    ? Math.round(fqRows.reduce((s, r) => s + (r.quality_score ?? 0), 0) / fqRows.length)
    : 0
  const highAdditiveRows = fqRows.filter((r) => (r.high_additive_count ?? 0) > 2).length
  const highAdditivePct = fqRows.length > 0 ? Math.round((highAdditiveRows / fqRows.length) * 100) : 0
  const avgWholeFood = fqRows.length > 0
    ? Math.round(fqRows.reduce((s, r) => s + (r.whole_food_count ?? 0), 0) / fqRows.length)
    : 0

  const foodQualityStats: FoodQualityStats = {
    avgQualityScore,
    totalLogs: fqRows.length,
    highAdditivePct,
    wholeFoodPct: avgWholeFood,
  }

  return (
    <NutritionClient
      meals={mealsWithUser}
      aiUsageStats={aiUsageStats}
      productAnalysisStats={productAnalysisStats}
      foodQualityStats={foodQualityStats}
    />
  )
}
