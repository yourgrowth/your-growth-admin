'use client'

import { useState, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { flagMeal, unflagMeal, deleteMeal } from '@/app/actions/nutrition'
import type { MealSuggestion } from '@/types/database'

export type MealWithUser = MealSuggestion & { user_name: string | null }

type Filter = 'all' | 'flagged'

function parseCount(val: string | null): number {
  if (!val) return 0
  try {
    const arr = JSON.parse(val)
    if (Array.isArray(arr)) return arr.length
  } catch {}
  return val.split(',').filter(Boolean).length
}

export default function NutritionClient({ meals }: { meals: MealWithUser[] }) {
  const [filter, setFilter] = useState<Filter>('all')
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
      <PageHeader title="Nutrition" subtitle="Meal suggestions from users" />

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
              {meal.suggestion ?? '—'}
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
    </div>
  )
}
