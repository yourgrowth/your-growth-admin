'use client'

import { useState, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { sendNotification } from '@/app/actions/notifications'
import type { NotificationLog } from '@/types/database'

const SEGMENTS = [
  { label: 'All users', value: 'all' },
  { label: 'Pro users', value: 'pro' },
  { label: 'Free users', value: 'free' },
  { label: 'Active 7d', value: 'active_7d' },
  { label: 'Inactive 7d+', value: 'inactive_7d' },
]

const SEGMENT_COLORS: Record<string, string> = {
  all: '#58a6ff',
  pro: '#bc8cff',
  free: '#7d8fa3',
  active_7d: '#3fb950',
  inactive_7d: '#d29922',
}

const inputStyle: React.CSSProperties = {
  background: '#080b0f',
  border: '1px solid #1a2332',
  color: '#e6edf3',
  borderRadius: '6px',
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
}

export default function NotificationsClient({ history }: { history: NotificationLog[] }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [segment, setSegment] = useState('all')
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!title.trim() || !body.trim()) return
    startTransition(async () => {
      await sendNotification(title.trim(), body.trim(), segment)
      setTitle('')
      setBody('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    })
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Compose and review push notifications" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg p-6" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-5"
            style={{ color: '#7d8fa3' }}
          >
            Compose
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notification body"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>
                Segment
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value} style={{ background: '#0d1117' }}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Btn
                onClick={handleSend}
                disabled={isPending || !title.trim() || !body.trim()}
              >
                {isPending ? 'Sending…' : 'Send Notification'}
              </Btn>
              {sent && (
                <p className="text-xs mt-2" style={{ color: '#3fb950' }}>
                  Notification logged successfully.
                </p>
              )}
              <p className="text-xs mt-3" style={{ color: '#7d8fa3' }}>
                Actual push delivery requires Expo push tokens — this logs the notification for now.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-6" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-5"
            style={{ color: '#7d8fa3' }}
          >
            Notification History
          </h2>
          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '540px' }}>
            {history.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: '#7d8fa3' }}>
                No notifications sent yet.
              </p>
            )}
            {history.map((n) => (
              <div
                key={n.id}
                className="rounded p-4"
                style={{ background: '#080b0f', border: '1px solid #1a2332' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                    {n.title}
                  </p>
                  <Badge color={SEGMENT_COLORS[n.segment ?? 'all'] ?? '#7d8fa3'}>
                    {SEGMENTS.find((s) => s.value === n.segment)?.label ?? n.segment ?? 'All users'}
                  </Badge>
                </div>
                {n.body && (
                  <p
                    className="text-xs mb-2 line-clamp-2"
                    style={{ color: '#7d8fa3' }}
                  >
                    {n.body}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: '#7d8fa3' }}>
                  <span>{new Date(n.sent_at).toLocaleString()}</span>
                  <span style={{ color: '#58a6ff' }}>{n.open_count ?? 0} opens</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
