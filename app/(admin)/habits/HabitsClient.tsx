'use client'

import { useState, useMemo } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'

type HabitRow = {
  id: string
  name: string
  user_id: string
  user_name: string
  category: string | null
  created_at: string
  completions: number
}

type Props = {
  habits: HabitRow[]
  totalCompletions: number
  mostPopular: string
}

export default function HabitsClient({ habits, totalCompletions, mostPopular }: Props) {
  const [search, setSearch] = useState('')

  const avgCompletionRate = habits.length > 0
    ? (totalCompletions / habits.length).toFixed(1)
    : '0'

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return habits
    return habits.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.category ?? '').toLowerCase().includes(q)
    )
  }, [habits, search])

  return (
    <div>
      <PageHeader title="Habits" subtitle="User habit tracking" />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Habits Created" value={habits.length} color="#3fb950" />
        <StatCard
          label="Avg Completions / Habit"
          value={avgCompletionRate}
          sub={`${totalCompletions} total completions`}
          color="#58a6ff"
        />
        <StatCard
          label="Most Popular Habit"
          value={mostPopular || '—'}
          color="#bc8cff"
        />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by habit name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded px-3 py-2 text-sm outline-none"
          style={{
            background: '#0d1117',
            border: '1px solid #1a2332',
            color: '#e6edf3',
          }}
        />
        <button
          onClick={() => { window.location.href = '/api/export?table=habits' }}
          className="px-3 py-2 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
          style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
        >
          Export CSV
        </button>
      </div>

      <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              {['Habit Name', 'User', 'Category', 'Total Completions', 'Created'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: '#7d8fa3' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: '#7d8fa3', background: '#080b0f' }}
                >
                  No habits found
                </td>
              </tr>
            ) : (
              filtered.map((habit, i) => (
                <tr
                  key={habit.id}
                  style={{
                    background: '#080b0f',
                    borderBottom: i < filtered.length - 1 ? '1px solid #1a2332' : undefined,
                  }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: '#e6edf3' }}>
                    {habit.name}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#7d8fa3' }}>
                    {habit.user_name}
                  </td>
                  <td className="px-4 py-3">
                    {habit.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: '#39d0d8',
                          background: '#39d0d822',
                          border: '1px solid #39d0d844',
                        }}
                      >
                        {habit.category}
                      </span>
                    ) : (
                      <span style={{ color: '#7d8fa3' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#3fb950' }}>
                    {habit.completions}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                    {new Date(habit.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
