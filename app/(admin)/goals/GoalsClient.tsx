'use client'

import { useState, useMemo } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'

type GoalRow = {
  id: string
  title: string
  user_id: string
  user_name: string
  category: string | null
  progress: number | null
  status: string | null
  gardener_linked: boolean | null
  created_at: string
}

type Filter = 'all' | 'active' | 'completed'

type Props = {
  goals: GoalRow[]
  activeCount: number
  completedCount: number
  gardenerCount: number
}

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
]

function statusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'completed': return '#3fb950'
    case 'active': return '#58a6ff'
    case 'paused': return '#d29922'
    default: return '#7d8fa3'
  }
}

export default function GoalsClient({ goals, activeCount, completedCount, gardenerCount }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'active') return goals.filter((g) => g.status?.toLowerCase() !== 'completed')
    if (filter === 'completed') return goals.filter((g) => g.status?.toLowerCase() === 'completed')
    return goals
  }, [goals, filter])

  return (
    <div>
      <PageHeader title="Goals" subtitle="User goals and progress" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Active Goals" value={activeCount} color="#58a6ff" />
        <StatCard label="Completed Goals" value={completedCount} color="#3fb950" />
        <StatCard label="Gardener Linked" value={gardenerCount} color="#bc8cff" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
            style={{
              background: filter === value ? '#1a2332' : 'transparent',
              color: filter === value ? '#e6edf3' : '#7d8fa3',
              border: `1px solid ${filter === value ? '#3fb950' : '#1a2332'}`,
            }}
          >
            {label}
          </button>
        ))}
        </div>
        <button
          onClick={() => { window.location.href = '/api/export?table=goals' }}
          className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
          style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
        >
          Export CSV
        </button>
      </div>

      <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              {['Goal', 'User', 'Category', 'Progress', 'Status', 'Gardener'].map((col) => (
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
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: '#7d8fa3', background: '#080b0f' }}
                >
                  No goals found
                </td>
              </tr>
            ) : (
              filtered.map((goal, i) => (
                <tr
                  key={goal.id}
                  style={{
                    background: '#080b0f',
                    borderBottom: i < filtered.length - 1 ? '1px solid #1a2332' : undefined,
                  }}
                >
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: '#e6edf3' }}>
                    <span className="line-clamp-1">{goal.title}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                    {goal.user_name}
                  </td>
                  <td className="px-4 py-3">
                    {goal.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: '#39d0d8',
                          background: '#39d0d822',
                          border: '1px solid #39d0d844',
                        }}
                      >
                        {goal.category}
                      </span>
                    ) : (
                      <span style={{ color: '#7d8fa3' }}>â€”</span>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={goal.progress ?? 0} color="#58a6ff" />
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                        {goal.progress ?? 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(goal.status)}>
                      {goal.status ?? 'unknown'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {goal.gardener_linked ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: '#bc8cff',
                          background: '#bc8cff22',
                          border: '1px solid #bc8cff44',
                        }}
                      >
                        Linked
                      </span>
                    ) : (
                      <span style={{ color: '#1a2332' }}>â€”</span>
                    )}
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

