'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logLoginAttempt, logAdminLogin } from '@/app/actions/security'

const MAX_ATTEMPTS = 5

const inputStyle: React.CSSProperties = {
  background: '#080b0f',
  border: '1px solid #1a2332',
  color: '#e6edf3',
}

export default function LoginClient({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  const isLockedOut = initialError === 'too_many_attempts'

  const bannerMessage =
    initialError === 'too_many_attempts'
      ? 'Too many failed attempts. Try again in 15 minutes.'
      : initialError === 'session_expired'
        ? 'Your session expired. Please log in again.'
        : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      const { failureCount } = await logLoginAttempt(email, false).catch(() => ({ failureCount: 0 }))
      const remaining = MAX_ATTEMPTS - failureCount
      setAttemptsRemaining(remaining > 0 ? remaining : 0)

      if (remaining <= 0) {
        setError('Too many failed attempts. Try again in 15 minutes.')
      } else {
        setError(
          `${authError?.message ?? 'Login failed'}. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
        )
      }
      setLoading(false)
      return
    }

    // Non-blocking — missing tables must not prevent login
    try { await logLoginAttempt(email, true) } catch {}
    try { await logAdminLogin(data.user.id, navigator.userAgent) } catch {}

    // Check if MFA step-up is required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
      window.location.href = '/login/verify'
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#080b0f' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8 flex flex-col gap-6"
        style={{ background: '#0d1117', border: '1px solid #1a2332' }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold" style={{ color: '#3fb950' }}>
            YOUR GROWTH
          </span>
          <p className="text-xs" style={{ color: '#7d8fa3' }}>
            Admin Panel — sign in to continue
          </p>
        </div>

        {bannerMessage && (
          <div
            className="rounded px-3 py-2 text-xs"
            style={{
              background: 'rgba(248,81,73,0.1)',
              border: '1px solid rgba(248,81,73,0.3)',
              color: '#f85149',
            }}
          >
            {bannerMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: '#7d8fa3' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || isLockedOut}
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: '#7d8fa3' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || isLockedOut}
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#f85149' }}>
              {error}
            </p>
          )}

          {attemptsRemaining !== null && attemptsRemaining > 0 && !error?.includes('Too many') && (
            <p className="text-xs" style={{ color: '#d29922' }}>
              {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before
              lockout.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isLockedOut}
            className="w-full rounded py-2 text-sm font-medium transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ background: '#3fb950', color: '#080b0f' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
