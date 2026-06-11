'use client'

import { useState, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import ProgressBar from '@/components/ui/ProgressBar'
import { flagMeal, unflagMeal, deleteMeal } from '@/app/actions/nutrition'
import type { MealSuggestion } from '@/types/database'
import type { AiUsageStats, ProductAnalysisStats, FoodQualityStats } from './page'

export type MealWithUser = MealSuggestion & { user_name: string | null }

type Filter = 'all' | 'flagged'
type Tab = 'meals' | 'ai_usage' | 'food_quality'

function parseCount(val: string | null): number {
  if (!val) return 0
  try {
    const arr = JSON.parse(val)
    if (Array.isArray(arr)) return arr.length
  } catch {}
  return val.split(',').filter(Boolean).length
}

export default function NutritionClient({ meals, aiUsageStats, productAnalysisStats, foodQualityStats }: {
  meals: MealWithUser[]
  aiUsageStats: AiUsageStats
  productAnalysisStats: ProductAnalysisStats
  foodQualityStats: FoodQualityStats
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('meals')
  const [isPending, startTransition] = useTransition()

  const displayed = filter === 'flagged' ? meals.filter((m) => m.flagged) : meals
  const flaggedCount = meals.filter((m) => m.flagged).length
  const avgDislikes =
    meals.length > 0
      ? (meals.reduce((s, m) => s + parseCount(m.dislikes), 0) / meals.length).toFixed(1)
      : '0'
  const avgSwaps =
    meals.length > 0
      ? (meals.reduce((s, m) => s + parseCount(m.swaps), 0) / meals.length).toFixed(1)
      : '0'

  return (
    <div>
      <PageHeader title="Nutrition" subtitle="Meal suggestions, AI usage, and food quality" />

      <div className="flex mb-6" style={{ borderBottom: '1px solid #1a2332' }}>
        {([['meals', 'Meal Suggestions'], ['ai_usage', 'AI Usage'], ['food_quality', 'Food Quality']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer"
            style={{
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === key ? '#3fb950' : 'transparent'}`,
              color: tab === key ? '#e6edf3' : '#7d8fa3', marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ai_usage' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Calls (30d)" value={aiUsageStats.totalCalls} color="#3fb950" />
            <StatCard label="Estimated Cost" value={`$${aiUsageStats.estimatedCost.toFixed(2)}`} color="#d29922" />
            <StatCard label="Avg Response" value={aiUsageStats.avgDurationMs > 0 ? `${(aiUsageStats.avgDurationMs / 1000).toFixed(1)}s` : 'â€”'} color="#58a6ff" />
            <StatCard label="Error Rate" value={`${aiUsageStats.errorRate}%`} color={aiUsageStats.errorRate > 5 ? '#f85149' : '#3fb950'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Feature Breakdown</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Food Photo Analysis', value: aiUsageStats.foodAnalysisCalls, color: '#3fb950' },
                  { label: 'Meal Suggestions', value: aiUsageStats.mealSuggestionCalls, color: '#58a6ff' },
                  { label: 'Other Nutrition AI', value: Math.max(0, aiUsageStats.totalCalls - aiUsageStats.foodAnalysisCalls - aiUsageStats.mealSuggestionCalls), color: '#bc8cff' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: '#e6edf3' }}>{label}</span>
                      <span style={{ color: '#7d8fa3' }}>{value} calls</span>
                    </div>
                    <ProgressBar value={aiUsageStats.totalCalls > 0 ? (value / aiUsageStats.totalCalls) * 100 : 0} color={color} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>Token Usage (30d)</p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: '#7d8fa3' }}>Input tokens</span>
                  <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>{aiUsageStats.totalInputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: '#7d8fa3' }}>Output tokens</span>
                  <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>{aiUsageStats.totalOutputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: '#7d8fa3' }}>Est. input cost</span>
                  <span className="text-sm font-medium" style={{ color: '#3fb950' }}>${(aiUsageStats.totalInputTokens * 3 / 1_000_000).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: '#7d8fa3' }}>Est. output cost</span>
                  <span className="text-sm font-medium" style={{ color: '#3fb950' }}>${(aiUsageStats.totalOutputTokens * 15 / 1_000_000).toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>Product Analyses Cached</p>
              <p className="text-2xl font-bold" style={{ color: '#e6edf3' }}>{productAnalysisStats.totalAnalysed}</p>
              <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>Avg completeness: {productAnalysisStats.cacheHitRate}%</p>
            </div>
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>Avg Additive Risk</p>
              <p className="text-2xl font-bold" style={{ color: productAnalysisStats.avgRisk === 'Moderate' ? '#d29922' : '#3fb950' }}>{productAnalysisStats.avgRisk}</p>
            </div>
            <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>Error Rate</p>
              <p className="text-2xl font-bold" style={{ color: aiUsageStats.errorRate > 5 ? '#f85149' : '#3fb950' }}>{aiUsageStats.errorRate}%</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'food_quality' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Avg Quality Score (30d)" value={foodQualityStats.totalLogs > 0 ? foodQualityStats.avgQualityScore : 'â€”'} color={foodQualityStats.avgQualityScore >= 70 ? '#3fb950' : foodQualityStats.avgQualityScore >= 50 ? '#d29922' : '#f85149'} />
            <StatCard label="Quality Logs" value={foodQualityStats.totalLogs} color="#58a6ff" />
            <StatCard label="High-Additive Users" value={`${foodQualityStats.highAdditivePct}%`} color={foodQualityStats.highAdditivePct > 30 ? '#f85149' : '#d29922'} />
            <StatCard label="Avg Whole Foods/Day" value={foodQualityStats.wholeFoodPct} color="#3fb950" />
          </div>

          <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>Quality Score Distribution</p>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Excellent (80â€“100)', color: '#3fb950' },
                { label: 'Good (60â€“79)', color: '#58a6ff' },
                { label: 'Fair (40â€“59)', color: '#d29922' },
                { label: 'Poor (<40)', color: '#f85149' },
              ].map(({ label, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#e6edf3' }}>{label}</span>
                    <span style={{ color: '#7d8fa3' }}>â€”</span>
                  </div>
                  <ProgressBar value={0} color={color} />
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: '#7d8fa3' }}>
              Per-band counts will populate once food_quality_logs has 30+ days of data.
            </p>
          </div>
        </div>
      )}

      {tab === 'meals' && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Suggestions" value={meals.length} color="#58a6ff" />
        <StatCard label="Flagged" value={flaggedCount} color="#f85149" />
        <StatCard label="Average Dislikes" value={avgDislikes} color="#d29922" />
        <StatCard label="Average Swaps" value={avgSwaps} color="#3fb950" />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {(['all', 'flagged'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{
                background: filter === f ? '#1a2332' : 'transparent',
                color: filter === f ? '#e6edf3' : '#7d8fa3',
                border: `1px solid ${filter === f ? '#3fb950' : '#1a2332'}`,
              }}
            >
              {f === 'all' ? 'All' : 'Flagged'}
            </button>
          ))}
        </div>
        <button
          onClick={() => { window.location.href = '/api/export?table=nutrition' }}
          className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
          style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {displayed.length === 0 && (
          <p className="text-sm py-8 text-center" style={{ color: '#7d8fa3' }}>
            No suggestions found.
          </p>
        )}
        {displayed.map((meal) => (
          <div
            key={meal.id}
            className="rounded-lg p-5"
            style={{
              background: '#0d1117',
              border: `1px solid ${meal.flagged ? '#f85149' : '#1a2332'}`,
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                  {meal.user_name ?? 'Unknown User'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                  {new Date(meal.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                {meal.flagged && <Badge color="#f85149">Flagged</Badge>}
                <Badge color="#d29922">{parseCount(meal.dislikes)} dislikes</Badge>
                <Badge color="#3fb950">{parseCount(meal.swaps)} swaps</Badge>
              </div>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: '#e6edf3' }}>
              {meal.suggestion ?? 'â€”'}
            </p>
            <div className="flex gap-2">
              <Btn
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await (meal.flagged ? unflagMeal(meal.id) : flagMeal(meal.id))
                  })
                }
              >
                {meal.flagged ? 'Unflag' : 'Flag'}
              </Btn>
              <Btn
                variant="danger"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteMeal(meal.id)
                  })
                }
              >
                Remove
              </Btn>
            </div>
          </div>
        ))}
      </div>
      </>}
    </div>
  )
}

