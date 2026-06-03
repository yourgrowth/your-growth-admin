'use client'

import { useState, useTransition } from 'react'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { sendReengagement } from '@/app/actions/subscriptions'

export type ChurnUser = {
  id: string
  full_name: string | null
  plan: string | null
  streak: number | null
  last_sign_in_at: string | null
  riskScore: number
}

function riskColor(score: number) {
  if (score >= 6) return '#f85149'
  if (score >= 3) return '#d29922'
  return '#3fb950'
}

function riskLabel(score: number) {
  if (score >= 6) return 'High'
  if (score >= 3) return 'Medium'
  return 'Low'
}

function formatLastActive(val: string | null) {
  if (!val) return 'Never'
  const days = Math.floor((Date.now() - new Date(val).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

export default function ChurnClient({ users }: { users: ChurnUser[] }) {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState<Set<string>>(new Set())

  if (users.length === 0) {
    return (
      <div
        className="rounded-lg p-8 text-center"
        style={{ background: '#0d1117', border: '1px solid #1a2332' }}
      >
        <p className="text-sm" style={{ color: '#7d8fa3' }}>
          No pro users to analyze.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
            {['User', 'Plan', 'Streak', 'Last Active', 'Risk Score', 'Action'].map((col) => (
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
          {users.map((user, i) => (
            <tr
              key={user.id}
              style={{
                background: '#080b0f',
                borderBottom: i < users.length - 1 ? '1px solid #1a2332' : undefined,
              }}
            >
              <td className="px-4 py-3">
                <p style={{ color: '#e6edf3' }}>{user.full_name ?? '—'}</p>
              </td>
              <td className="px-4 py-3">
                <Badge color="#bc8cff">{user.plan ?? 'pro'}</Badge>
              </td>
              <td className="px-4 py-3 font-medium" style={{ color: '#3fb950' }}>
                {user.streak ?? 0}
              </td>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#7d8fa3' }}>
                {formatLastActive(user.last_sign_in_at)}
              </td>
              <td className="px-4 py-3">
                <Badge color={riskColor(user.riskScore)}>
                  {riskLabel(user.riskScore)} ({user.riskScore})
                </Badge>
              </td>
              <td className="px-4 py-3">
                {sent.has(user.id) ? (
                  <span className="text-xs" style={{ color: '#3fb950' }}>
                    Sent
                  </span>
                ) : (
                  <Btn
                    variant="ghost"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await sendReengagement(user.id, user.full_name)
                        setSent((prev) => new Set([...prev, user.id]))
                      })
                    }
                  >
                    Re-engage
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
