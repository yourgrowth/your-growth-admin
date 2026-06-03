'use client'

import { useState, useTransition, useEffect } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import TicketDrawer from '@/components/TicketDrawer'
import { getTickets, getSupportStats, deleteTicket } from '@/app/actions/support'
import type { TicketWithUser, SupportStats } from '@/app/actions/support'

type StatusFilter = 'All' | 'Open' | 'In Progress' | 'Resolved'
type PriorityFilter = 'All' | 'Urgent' | 'High' | 'Normal' | 'Low'

const T = { fontFamily: 'IBM Plex Mono, monospace' }

function priorityColor(p: string) {
  if (p === 'urgent') return '#f85149'
  if (p === 'high') return '#d29922'
  if (p === 'normal') return '#58a6ff'
  return '#7d8fa3'
}

function statusColor(s: string) {
  if (s === 'open') return '#f85149'
  if (s === 'in_progress') return '#d29922'
  if (s === 'resolved') return '#3fb950'
  return '#7d8fa3'
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<TicketWithUser[]>([])
  const [stats, setStats] = useState<SupportStats>({ open: 0, inProgress: 0, resolvedToday: 0, avgResponseMs: null })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All')
  const [selected, setSelected] = useState<TicketWithUser | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const [t, s] = await Promise.all([getTickets(), getSupportStats()])
      setTickets(t)
      setStats(s)
    })
  }, [])

  function refresh() {
    startTransition(async () => {
      const [t, s] = await Promise.all([getTickets(), getSupportStats()])
      setTickets(t)
      setStats(s)
    })
  }

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'All' && t.status !== statusFilter.toLowerCase().replace(' ', '_')) return false
    if (priorityFilter !== 'All' && t.priority !== priorityFilter.toLowerCase()) return false
    return true
  })

  return (
    <div style={T}>
      <PageHeader title="Support" subtitle="User support ticket management" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Tickets" value={stats.open} color="#f85149" />
        <StatCard label="In Progress" value={stats.inProgress} color="#d29922" />
        <StatCard label="Resolved Today" value={stats.resolvedToday} color="#3fb950" />
        <StatCard label="Avg Response Time" value={stats.avgResponseMs ? `${Math.round(stats.avgResponseMs / 60000)}m` : '—'} color="#58a6ff" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {(['All', 'Open', 'In Progress', 'Resolved'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-3 py-1.5 rounded text-xs"
              style={{
                background: statusFilter === f ? '#1a2332' : 'transparent',
                color: statusFilter === f ? '#e6edf3' : '#7d8fa3',
                border: `1px solid ${statusFilter === f ? '#1a2332' : 'transparent'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-4">
          {(['All', 'Urgent', 'High', 'Normal', 'Low'] as PriorityFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setPriorityFilter(f)}
              className="px-3 py-1.5 rounded text-xs"
              style={{
                background: priorityFilter === f ? '#1a2332' : 'transparent',
                color: priorityFilter === f ? '#e6edf3' : '#7d8fa3',
                border: `1px solid ${priorityFilter === f ? '#1a2332' : 'transparent'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets table */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              {['Subject', 'User', 'Priority', 'Status', 'Created', 'Assigned To', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isPending && tickets.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs" style={{ color: '#7d8fa3', background: '#080b0f' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs" style={{ color: '#7d8fa3', background: '#080b0f' }}>No tickets found.</td></tr>
            ) : (
              filtered.map(ticket => (
                <tr
                  key={ticket.id}
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelected(ticket)}
                  style={{ background: '#080b0f', borderBottom: '1px solid #1a2332' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0d1117')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#080b0f')}
                >
                  <td className="px-4 py-3 max-w-48">
                    <p className="truncate text-sm" style={{ color: '#e6edf3' }}>{ticket.subject ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: '#e6edf3' }}>{ticket.user_name ?? '—'}</p>
                    <p className="text-xs" style={{ color: '#7d8fa3' }}>{ticket.user_email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3"><Badge color={priorityColor(ticket.priority)}>{ticket.priority}</Badge></td>
                  <td className="px-4 py-3"><Badge color={statusColor(ticket.status)}>{ticket.status.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#7d8fa3' }}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#7d8fa3' }}>{ticket.assigned_name ?? '—'}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (confirm('Delete this ticket?')) {
                          startTransition(async () => {
                            await deleteTicket(ticket.id)
                            refresh()
                          })
                        }
                      }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'transparent', border: '1px solid #f85149', color: '#f85149' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TicketDrawer
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdate={refresh}
        />
      )}
    </div>
  )
}
