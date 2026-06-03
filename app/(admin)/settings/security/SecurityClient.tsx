'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signOutAllSessions } from '@/app/actions/security'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'

type Session = {
  id: string
  admin_id: string | null
  ip_address: string | null
  user_agent: string | null
  logged_in_at: string
  logged_out_at: string | null
}

type Attempt = {
  id: string
  ip_address: string
  email: string | null
  success: boolean
  attempted_at: string
}

type MfaFactor = {
  id: string
  status: 'verified' | 'unverified'
  friendly_name?: string
}

export default function SecurityClient({
  userId,
  sessions,
  attempts,
}: {
  userId: string
  sessions: Session[]
  attempts: Attempt[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // MFA state
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState<string | null>(null)

  const verifiedFactor = factors.find((f) => f.status === 'verified')

  useEffect(() => {
    loadFactors()
  }, [])

  async function loadFactors() {
    setMfaLoading(true)
    const supabase = createClient()
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors(data?.totp ?? [])
    setMfaLoading(false)
  }

  async function handleEnroll() {
    setMfaError(null)
    setEnrolling(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Admin Panel',
    })
    if (error || !data) {
      setMfaError(error?.message ?? 'Failed to start enrollment')
      setEnrolling(false)
      return
    }
    setQrCode(data.totp.qr_code)
    setTotpSecret(data.totp.secret)
    setEnrollFactorId(data.id)
    setEnrolling(false)
  }

  async function handleVerifyEnrollment() {
    if (!enrollFactorId || verifyCode.length < 6) return
    setMfaError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollFactorId,
      code: verifyCode.replace(/\s/g, ''),
    })
    if (error) {
      setMfaError(error.message)
      return
    }
    setQrCode(null)
    setTotpSecret(null)
    setEnrollFactorId(null)
    setVerifyCode('')
    await loadFactors()
  }

  async function handleUnenroll() {
    if (!verifiedFactor) return
    setMfaError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id })
    if (error) {
      setMfaError(error.message)
      return
    }
    await loadFactors()
  }

  function handleSignOutAll() {
    startTransition(async () => {
      const { error } = await signOutAllSessions()
      if (!error) {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
      }
    })
  }

  const activeSessions = sessions.filter((s) => !s.logged_out_at)
  const loginHistory = sessions

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Security" subtitle="2FA, sessions, and login activity" />

      {/* Two-Factor Authentication */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Two-Factor Authentication
        </h2>
        <div
          className="rounded-lg p-5 flex flex-col gap-4"
          style={{ background: '#0d1117', border: '1px solid #1a2332' }}
        >
          {mfaLoading ? (
            <p className="text-sm" style={{ color: '#7d8fa3' }}>
              Loading…
            </p>
          ) : verifiedFactor ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge color="#3fb950">Enabled</Badge>
                <span className="text-sm" style={{ color: '#e6edf3' }}>
                  TOTP authenticator active
                </span>
              </div>
              <Btn variant="danger" onClick={handleUnenroll}>
                Disable 2FA
              </Btn>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: '#e6edf3' }}>
                Scan this QR code with Google Authenticator or Authy, then enter the 6-digit code
                to confirm.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="2FA QR code"
                className="rounded"
                style={{ width: 160, height: 160, background: '#fff', padding: 4 }}
              />
              {totpSecret && (
                <p className="text-xs font-mono" style={{ color: '#7d8fa3' }}>
                  Manual key: {totpSecret}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="rounded px-3 py-2 text-sm font-mono tracking-widest text-center outline-none"
                  style={{
                    width: 120,
                    background: '#080b0f',
                    border: '1px solid #1a2332',
                    color: '#e6edf3',
                  }}
                />
                <Btn
                  onClick={handleVerifyEnrollment}
                  disabled={verifyCode.length < 6}
                >
                  Confirm
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => {
                    setQrCode(null)
                    setTotpSecret(null)
                    setEnrollFactorId(null)
                    setVerifyCode('')
                  }}
                >
                  Cancel
                </Btn>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge color="#7d8fa3">Disabled</Badge>
                <span className="text-sm" style={{ color: '#7d8fa3' }}>
                  No authenticator enrolled
                </span>
              </div>
              <Btn onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? 'Starting…' : 'Enable 2FA'}
              </Btn>
            </div>
          )}
          {mfaError && (
            <p className="text-xs" style={{ color: '#f85149' }}>
              {mfaError}
            </p>
          )}
        </div>
      </section>

      {/* Active Sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#7d8fa3' }}
          >
            Active Sessions ({activeSessions.length})
          </h2>
          <Btn variant="danger" disabled={isPending} onClick={handleSignOutAll}>
            {isPending ? 'Signing out…' : 'Sign out all sessions'}
          </Btn>
        </div>
        <SessionTable sessions={activeSessions} />
      </section>

      {/* Login History */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Login History
        </h2>
        <SessionTable sessions={loginHistory} showStatus />
      </section>

      {/* Login Attempts */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#7d8fa3' }}
        >
          Login Attempts
        </h2>
        <AttemptsTable attempts={attempts} />
      </section>
    </div>
  )
}

function SessionTable({
  sessions,
  showStatus,
}: {
  sessions: Session[]
  showStatus?: boolean
}) {
  if (sessions.length === 0) {
    return (
      <div
        className="rounded-lg px-4 py-6 text-sm text-center"
        style={{ background: '#0d1117', border: '1px solid #1a2332', color: '#7d8fa3' }}
      >
        No sessions found.
      </div>
    )
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
      {sessions.map((s, i) => (
        <div
          key={s.id}
          className="flex items-start justify-between px-4 py-3 gap-4"
          style={{
            background: '#0d1117',
            borderBottom: i < sessions.length - 1 ? '1px solid #1a2332' : undefined,
          }}
        >
          <div className="min-w-0 flex flex-col gap-0.5">
            <p className="text-sm truncate" style={{ color: '#e6edf3' }}>
              {s.ip_address ?? '—'}
            </p>
            <p className="text-xs truncate" style={{ color: '#7d8fa3' }}>
              {s.user_agent
                ? s.user_agent.length > 60
                  ? s.user_agent.slice(0, 60) + '…'
                  : s.user_agent
                : '—'}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {showStatus && (
              <Badge color={s.logged_out_at ? '#7d8fa3' : '#3fb950'}>
                {s.logged_out_at ? 'Ended' : 'Active'}
              </Badge>
            )}
            <p className="text-xs" style={{ color: '#7d8fa3' }}>
              {new Date(s.logged_in_at).toLocaleString()}
            </p>
            {s.logged_out_at && (
              <p className="text-xs" style={{ color: '#7d8fa3' }}>
                → {new Date(s.logged_out_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AttemptsTable({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) {
    return (
      <div
        className="rounded-lg px-4 py-6 text-sm text-center"
        style={{ background: '#0d1117', border: '1px solid #1a2332', color: '#7d8fa3' }}
      >
        No login attempts recorded.
      </div>
    )
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
      <div
        className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{
          gridTemplateColumns: '1fr 1fr 80px 1fr',
          color: '#7d8fa3',
          background: '#080b0f',
          borderBottom: '1px solid #1a2332',
        }}
      >
        <span>IP Address</span>
        <span>Email</span>
        <span>Status</span>
        <span>Time</span>
      </div>
      {attempts.map((a, i) => (
        <div
          key={a.id}
          className="grid px-4 py-3 items-center"
          style={{
            gridTemplateColumns: '1fr 1fr 80px 1fr',
            background: '#0d1117',
            borderBottom: i < attempts.length - 1 ? '1px solid #1a2332' : undefined,
          }}
        >
          <p className="text-sm font-mono" style={{ color: '#e6edf3' }}>
            {a.ip_address}
          </p>
          <p className="text-sm truncate" style={{ color: '#7d8fa3' }}>
            {a.email ?? '—'}
          </p>
          <span>
            <Badge color={a.success ? '#3fb950' : '#f85149'}>
              {a.success ? 'OK' : 'Fail'}
            </Badge>
          </span>
          <p className="text-xs" style={{ color: '#7d8fa3' }}>
            {new Date(a.attempted_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
