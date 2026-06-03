'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)

  useEffect(() => {
    async function loadFactor() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error || !data) return
      const totp = data.totp?.find((f) => f.status === 'verified')
      if (totp) setFactorId(totp.id)
    }
    loadFactor()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.replace(/\s/g, ''),
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
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
            🌿 BONSAI
          </span>
          <p className="text-xs" style={{ color: '#7d8fa3' }}>
            Two-factor authentication
          </p>
        </div>

        <p className="text-sm" style={{ color: '#e6edf3' }}>
          Enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: '#7d8fa3' }}>
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              required
              disabled={loading || !factorId}
              autoFocus
              className="w-full rounded px-3 py-2 text-sm font-mono tracking-widest text-center outline-none focus:ring-1 disabled:opacity-50"
              style={{
                background: '#080b0f',
                border: '1px solid #1a2332',
                color: '#e6edf3',
                fontSize: '20px',
                letterSpacing: '0.3em',
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#f85149' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !factorId || code.replace(/\s/g, '').length < 6}
            className="w-full rounded py-2 text-sm font-medium transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ background: '#3fb950', color: '#080b0f' }}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full rounded py-2 text-sm transition-opacity cursor-pointer"
            style={{ color: '#7d8fa3' }}
          >
            Back to sign in
          </button>
        </form>
      </div>
    </div>
  )
}
