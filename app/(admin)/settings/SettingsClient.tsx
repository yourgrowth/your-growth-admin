'use client'

import { useState, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { toggleFlag, revokeAdmin, grantAdmin } from '@/app/actions/settings'
import type { FeatureFlag } from '@/types/database'

type AdminUser = {
  id: string
  full_name: string | null
  email: string
  created_at: string
}

type Props = {
  flags: FeatureFlag[]
  admins: AdminUser[]
}

const inputStyle: React.CSSProperties = {
  background: '#080b0f',
  border: '1px solid #1a2332',
  color: '#e6edf3',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
}

export default function SettingsClient({ flags, admins }: Props) {
  const [isPending, startTransition] = useTransition()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  function handleToggle(id: string, enabled: boolean) {
    startTransition(async () => {
      await toggleFlag(id, !enabled)
    })
  }

  function handleRevoke(userId: string) {
    startTransition(async () => {
      await revokeAdmin(userId)
    })
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviteError(null)
    setInviteSuccess(false)
    startTransition(async () => {
      const result = await grantAdmin(inviteEmail.trim())
      if (result.error) {
        setInviteError(result.error)
      } else {
        setInviteEmail('')
        setInviteSuccess(true)
        setTimeout(() => setInviteSuccess(false), 3000)
      }
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Settings" subtitle="Feature flags, admin users, and app config" />

      {/* Feature Flags */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Feature Flags
        </h2>
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
          {flags.length === 0 && (
            <p
              className="px-4 py-6 text-sm text-center"
              style={{ color: '#7d8fa3', background: '#0d1117' }}
            >
              No feature flags found.
            </p>
          )}
          {flags.map((flag, i) => (
            <div
              key={flag.id}
              className="flex items-center justify-between px-4 py-4"
              style={{
                background: '#0d1117',
                borderBottom: i < flags.length - 1 ? '1px solid #1a2332' : undefined,
              }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                  {flag.label ?? flag.key}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono" style={{ color: '#7d8fa3' }}>
                    {flag.key}
                  </span>
                  {flag.scope && <Badge color="#7d8fa3">{flag.scope}</Badge>}
                </div>
              </div>
              <button
                onClick={() => handleToggle(flag.id, flag.enabled)}
                disabled={isPending}
                role="switch"
                aria-checked={flag.enabled}
                className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                style={{ background: flag.enabled ? '#3fb950' : '#1a2332' }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full transition-transform duration-200"
                  style={{
                    background: '#e6edf3',
                    transform: flag.enabled ? 'translateX(22px)' : 'translateX(2px)',
                    marginTop: '2px',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Admin Users */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Admin Users
        </h2>
        <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid #1a2332' }}>
          {admins.length === 0 && (
            <p
              className="px-4 py-6 text-sm text-center"
              style={{ color: '#7d8fa3', background: '#0d1117' }}
            >
              No admin users found.
            </p>
          )}
          {admins.map((admin, i) => (
            <div
              key={admin.id}
              className="flex items-center justify-between px-4 py-4 gap-4"
              style={{
                background: '#0d1117',
                borderBottom: i < admins.length - 1 ? '1px solid #1a2332' : undefined,
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
                  {admin.full_name ?? '—'}
                </p>
                <p className="text-xs truncate" style={{ color: '#7d8fa3' }}>
                  {admin.email}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                  Since {new Date(admin.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="shrink-0">
                <Btn variant="danger" disabled={isPending} onClick={() => handleRevoke(admin.id)}>
                  Revoke Admin
                </Btn>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#e6edf3' }}>
            Invite Admin
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <Btn onClick={handleInvite} disabled={isPending || !inviteEmail.trim()}>
              Grant Admin
            </Btn>
          </div>
          {inviteError && (
            <p className="text-xs mt-2" style={{ color: '#f85149' }}>
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p className="text-xs mt-2" style={{ color: '#3fb950' }}>
              Admin access granted successfully.
            </p>
          )}
        </div>
      </section>

      {/* App Version */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          App Version
        </h2>
        <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-2"
                style={{ color: '#7d8fa3' }}
              >
                Current Version
              </p>
              <p className="text-2xl font-bold font-mono" style={{ color: '#e6edf3' }}>
                1.2.4
              </p>
            </div>
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-2"
                style={{ color: '#7d8fa3' }}
              >
                Minimum Required
              </p>
              <p className="text-2xl font-bold font-mono" style={{ color: '#e6edf3' }}>
                1.0.0
              </p>
            </div>
            <div>
              <p
                className="text-xs uppercase tracking-wider mb-2"
                style={{ color: '#7d8fa3' }}
              >
                Force Update
              </p>
              <Badge color="#7d8fa3">Disabled</Badge>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
