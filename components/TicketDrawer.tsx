'use client'

import { useState, useTransition, useEffect } from 'react'
import Badge from '@/components/ui/Badge'
import {
  updatePriority, updateStatus, assignTicket,
  replyToTicket, resolveTicket, getTicketReplies, getAdminUsers,
} from '@/app/actions/support'
import type { TicketWithUser, ReplyWithSender } from '@/app/actions/support'

type Props = {
  ticket: TicketWithUser
  onClose: () => void
  onUpdate: () => void
}

const T = { fontFamily: 'IBM Plex Mono, monospace' }

const inp: React.CSSProperties = {
  background: '#080b0f', border: '1px solid #1a2332', color: '#e6edf3',
  borderRadius: 4, padding: '6px 10px', fontSize: 13, ...T, width: '100%', outline: 'none',
}

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

const sel: React.CSSProperties = {
  background: '#080b0f', border: '1px solid #1a2332', color: '#e6edf3',
  borderRadius: 4, padding: '4px 8px', fontSize: 12, ...T, outline: 'none',
}

export default function TicketDrawer({ ticket, onClose, onUpdate }: Props) {
  const [replies, setReplies] = useState<ReplyWithSender[]>([])
  const [admins, setAdmins] = useState<{ id: string; full_name: string | null }[]>([])
  const [replyBody, setReplyBody] = useState('')
  const [priority, setPriority] = useState(ticket.priority)
  const [status, setStatus] = useState(ticket.status)
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to ?? '')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const [r, a] = await Promise.all([getTicketReplies(ticket.id), getAdminUsers()])
      setReplies(r)
      setAdmins(a)
    })
  }, [ticket.id])

  function refreshReplies() {
    startTransition(async () => {
      setReplies(await getTicketReplies(ticket.id))
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
        style={{ width: 580, background: '#0d1117', borderLeft: '1px solid #1a2332', ...T }}
      >
        {/* Header */}
        <div className="p-6 shrink-0" style={{ borderBottom: '1px solid #1a2332' }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <p className="font-semibold" style={{ color: '#e6edf3' }}>{ticket.subject ?? 'No subject'}</p>
              <div className="flex gap-2 mt-1.5">
                <Badge color={priorityColor(priority)}>{priority}</Badge>
                <Badge color={statusColor(status)}>{status.replace('_', ' ')}</Badge>
              </div>
            </div>
            <button onClick={onClose} className="text-lg leading-none shrink-0" style={{ color: '#7d8fa3' }}>✕</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* User info */}
          <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: '#080b0f', border: '1px solid #1a2332' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#7d8fa3' }}>User</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span style={{ color: '#7d8fa3' }}>Name: </span><span style={{ color: '#e6edf3' }}>{ticket.user_name ?? '—'}</span></div>
              <div><span style={{ color: '#7d8fa3' }}>Email: </span><span style={{ color: '#e6edf3' }}>{ticket.user_email ?? '—'}</span></div>
              <div><span style={{ color: '#7d8fa3' }}>Plan: </span><span style={{ color: '#bc8cff' }}>{ticket.user_plan ?? '—'}</span></div>
              <div><span style={{ color: '#7d8fa3' }}>Stage: </span><span style={{ color: '#3fb950' }}>{ticket.user_stage ?? '—'}</span></div>
            </div>
          </div>

          {/* Description */}
          {ticket.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7d8fa3' }}>Description</p>
              <p className="text-sm" style={{ color: '#e6edf3' }}>{ticket.description}</p>
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Priority</p>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={sel}
                onBlur={() => startTransition(() => updatePriority(ticket.id, priority))}
              >
                {['urgent', 'high', 'normal', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Status</p>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={sel}
                onBlur={() => startTransition(() => updateStatus(ticket.id, status))}
              >
                {['open', 'in_progress', 'resolved'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Assign To</p>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                style={sel}
                onBlur={() => { if (assignedTo) startTransition(() => assignTicket(ticket.id, assignedTo)) }}
              >
                <option value="">Unassigned</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.full_name ?? a.id.slice(0, 8)}</option>)}
              </select>
            </div>
          </div>

          {/* Apply buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(async () => {
                await Promise.all([
                  updatePriority(ticket.id, priority),
                  updateStatus(ticket.id, status),
                  assignedTo ? assignTicket(ticket.id, assignedTo) : Promise.resolve(),
                ])
                onUpdate()
              })}
              disabled={isPending}
              className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: '#1a2332', color: '#e6edf3', border: '1px solid #1a2332' }}
            >
              Apply Changes
            </button>
            {status !== 'resolved' && (
              <button
                onClick={() => startTransition(async () => {
                  await resolveTicket(ticket.id)
                  setStatus('resolved')
                  onUpdate()
                })}
                disabled={isPending}
                className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                style={{ background: '#3fb95022', color: '#3fb950', border: '1px solid #3fb95044' }}
              >
                Resolve Ticket
              </button>
            )}
          </div>

          {/* Reply thread */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7d8fa3' }}>
              Replies ({replies.length})
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {replies.length === 0 && !isPending && (
                <p className="text-xs" style={{ color: '#7d8fa3' }}>No replies yet.</p>
              )}
              {replies.map(r => (
                <div
                  key={r.id}
                  className="rounded px-3 py-2.5 flex flex-col gap-1"
                  style={{ background: r.is_admin ? '#1a233244' : '#080b0f', border: '1px solid #1a2332' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: r.is_admin ? '#3fb950' : '#e6edf3' }}>
                      {r.sender_name ?? 'Unknown'}
                    </span>
                    {r.is_admin && <Badge color="#3fb950">Admin</Badge>}
                  </div>
                  <p className="text-sm" style={{ color: '#e6edf3' }}>{r.body}</p>
                  <p className="text-xs" style={{ color: '#7d8fa3' }}>{new Date(r.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Reply form */}
            <div className="flex flex-col gap-2">
              <textarea
                placeholder="Write a reply…"
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                rows={3}
                style={{ ...inp, resize: 'vertical' }}
              />
              <button
                onClick={() => {
                  if (!replyBody.trim()) return
                  startTransition(async () => {
                    await replyToTicket(ticket.id, replyBody.trim())
                    setReplyBody('')
                    refreshReplies()
                  })
                }}
                disabled={isPending || !replyBody.trim()}
                className="self-start px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44' }}
              >
                Send Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
