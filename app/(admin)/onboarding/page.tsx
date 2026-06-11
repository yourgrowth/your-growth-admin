'use client'

import { useState, useTransition, useEffect } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import {
  getStepStats, getUsersAtStep, sendReengagement,
  getStepTimeStats, getWeekCohorts, getStepStatsForCohort,
} from '@/app/actions/onboarding'
import type { StepStat, DroppedUser, TimeStatRow, CohortWeek } from '@/app/actions/onboarding-constants'
import { ONBOARDING_STEPS } from '@/app/actions/onboarding-constants'

const T = { fontFamily: 'IBM Plex Mono, monospace' }

const STEP_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  create_profile: 'Create Profile',
  first_habit: 'First Habit',
  set_goal: 'Set Goal',
  nutrition_setup: 'Nutrition Setup',
  gardener_intro: 'Gardener Intro',
  first_completion: 'First Completion',
  pro_upsell: 'Pro Upsell',
  complete: 'Complete',
}

function dropoffColor(rate: number) {
  if (rate < 10) return '#3fb950'
  if (rate < 25) return '#d29922'
  return '#f85149'
}

export default function OnboardingPage() {
  const [stats, setStats] = useState<StepStat[]>([])
  const [timeStats, setTimeStats] = useState<TimeStatRow[]>([])
  const [cohorts, setCohorts] = useState<CohortWeek[]>([])
  const [selectedCohort, setSelectedCohort] = useState<CohortWeek | null>(null)
  const [cohortStats, setCohortStats] = useState<StepStat[]>([])
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [droppedUsers, setDroppedUsers] = useState<DroppedUser[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const [s, t, c] = await Promise.all([getStepStats(), getStepTimeStats(), getWeekCohorts()])
      setStats(s)
      setTimeStats(t)
      setCohorts(c)
    })
  }, [])

  function selectStep(step: string) {
    setSelectedStep(step)
    setDroppedUsers([])
    startTransition(async () => {
      setDroppedUsers(await getUsersAtStep(step))
    })
  }

  function selectCohort(cohort: CohortWeek | null) {
    setSelectedCohort(cohort)
    if (!cohort) { setCohortStats([]); return }
    startTransition(async () => {
      setCohortStats(await getStepStatsForCohort(cohort.userIds))
    })
  }

  const displayStats = selectedCohort && cohortStats.length > 0 ? cohortStats : stats
  const firstStep = displayStats[0]?.reached ?? 1

  const totalStarted = stats[0]?.reached ?? 0
  const totalCompleted = stats[stats.length - 1]?.reached ?? 0
  const overallRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0

  return (
    <div style={T}>
      <PageHeader
        title="Onboarding Funnel"
        subtitle={`${totalStarted} users started · ${overallRate}% overall completion rate`}
      />

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Funnel chart */}
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Funnel</p>
            <select
              value={selectedCohort?.week ?? ''}
              onChange={e => {
                const cohort = cohorts.find(c => c.week === e.target.value) ?? null
                selectCohort(cohort)
              }}
              style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#e6edf3', borderRadius: 4, padding: '3px 8px', fontSize: 12, ...T, outline: 'none' }}
            >
              <option value="">All time</option>
              {cohorts.map(c => <option key={c.week} value={c.week}>{c.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            {displayStats.map((stat, i) => {
              const prev = i > 0 ? displayStats[i - 1].reached : stat.reached
              const dropoffRate = prev > 0 ? Math.round(((prev - stat.reached) / prev) * 100) : 0
              const barPct = firstStep > 0 ? (stat.reached / firstStep) * 100 : 0

              return (
                <div
                  key={stat.step}
                  className="cursor-pointer"
                  onClick={() => selectStep(stat.step)}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: selectedStep === stat.step ? '#58a6ff' : '#e6edf3' }}>
                      {STEP_LABELS[stat.step] ?? stat.step}
                    </span>
                    <div className="flex items-center gap-3">
                      <span style={{ color: '#7d8fa3' }}>{stat.reached.toLocaleString()}</span>
                      <span style={{ color: '#7d8fa3' }}>{firstStep > 0 ? Math.round((stat.reached / firstStep) * 100) : 0}%</span>
                      {i > 0 && <span style={{ color: dropoffColor(dropoffRate) }}>-{dropoffRate}%</span>}
                    </div>
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ background: '#1a2332', height: 8 }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barPct}%`, background: '#58a6ff' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Dropped users */}
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>
            {selectedStep ? `Dropped at: ${STEP_LABELS[selectedStep] ?? selectedStep}` : 'Select a step to see drop-offs'}
          </p>
          {isPending ? (
            <p className="text-xs" style={{ color: '#7d8fa3' }}>Loading…</p>
          ) : droppedUsers.length === 0 ? (
            <p className="text-xs" style={{ color: '#7d8fa3' }}>{selectedStep ? 'No dropped users at this step.' : 'Click any funnel step above.'}</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {droppedUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: '#080b0f', border: '1px solid #1a2332' }}
                >
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#e6edf3' }}>{u.display_name ?? '—'}</p>
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>{u.email ?? ''} · {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.subscription_status && <Badge color="#bc8cff">{u.subscription_status}</Badge>}
                    <button
                      onClick={() => startTransition(async () => { await sendReengagement(u.id) })}
                      disabled={isPending}
                      className="text-xs px-2 py-1 rounded disabled:opacity-50"
                      style={{ background: 'transparent', border: '1px solid #3fb950', color: '#3fb950' }}
                    >
                      Re-engage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Time analysis */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
        <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Time Spent per Step (avg seconds)</p>
        </div>
        <table className="w-full text-sm" style={{ background: '#080b0f' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a2332' }}>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Step</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Avg Time (s)</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {timeStats.map(row => (
              <tr key={row.step} style={{ borderBottom: '1px solid #1a2332' }}>
                <td className="px-4 py-3" style={{ color: '#e6edf3' }}>{STEP_LABELS[row.step] ?? row.step}</td>
                <td className="px-4 py-3 font-medium" style={{ color: row.avgSeconds > 60 ? '#f85149' : '#3fb950' }}>
                  {row.avgSeconds}s
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#7d8fa3' }}>
                  {row.avgSeconds > 60 ? '⚠ High — may indicate confusion' : ''}
                </td>
              </tr>
            ))}
            {timeStats.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-xs" style={{ color: '#7d8fa3' }}>No time data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
