'use client'

import { useState, useTransition } from 'react'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import { toggleGlobalFlag, setUserFlagOverride, deleteUserFlagOverride } from '@/app/actions/featureFlags'

type Flag = {
  id: string
  name: string
  enabled: boolean
  description: string | null
  updated_at: string | null
  updated_by: string | null
}

type Override = {
  id: string
  user_id: string
  flag_name: string
  enabled: boolean
  created_at: string
}

type Profile = {
  id: string
  full_name: string | null
}

type Tab = 'global' | 'user'

type Props = {
  flags: Flag[]
  overrides: Override[]
  profiles: Profile[]
}

export default function FeatureFlagsClient({ flags: initialFlags, overrides: initialOverrides, profiles }: Props) {
  const [tab, setTab] = useState<Tab>('global')
  const [flags, setFlags] = useState<Flag[]>(initialFlags)
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedFlag, setSelectedFlag] = useState('')
  const [selectedEnabled, setSelectedEnabled] = useState(true)
  const [isPending, startTransition] = useTransition()

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]))

  const enabledCount = flags.filter((f) => f.enabled).length

  function handleToggle(flag: Flag) {
    if (!flag.enabled && confirmId !== flag.id) {
      setConfirmId(flag.id)
      return
    }
    setConfirmId(null)
    startTransition(async () => {
      await toggleGlobalFlag(flag.id, !flag.enabled)
      setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, enabled: !f.enabled, updated_at: new Date().toISOString() } : f))
    })
  }

  function handleAddOverride() {
    if (!selectedUserId || !selectedFlag) return
    startTransition(async () => {
      await setUserFlagOverride(selectedUserId, selectedFlag, selectedEnabled)
      setOverrides((prev) => [
        ...prev.filter((o) => !(o.user_id === selectedUserId && o.flag_name === selectedFlag)),
        { id: `${selectedUserId}-${selectedFlag}`, user_id: selectedUserId, flag_name: selectedFlag, enabled: selectedEnabled, created_at: new Date().toISOString() },
      ])
      setSelectedUserId('')
      setSelectedFlag('')
    })
  }

  function handleDeleteOverride(override: Override) {
    startTransition(async () => {
      await deleteUserFlagOverride(override.id)
      setOverrides((prev) => prev.filter((o) => o.id !== override.id))
    })
  }

  const inp: React.CSSProperties = {
    background: '#080b0f',
    border: '1px solid #1a2332',
    color: '#e6edf3',
    borderRadius: 4,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Flags" value={flags.length} color="#e6edf3" />
        <StatCard label="Enabled" value={enabledCount} color="#3fb950" />
        <StatCard label="User Overrides" value={overrides.length} color="#58a6ff" />
      </div>

      {/* Tabs */}
      <div className="flex mb-6" style={{ borderBottom: '1px solid #1a2332' }}>
        {([['global', 'Global Flags'], ['user', 'Per-User Overrides']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === id ? '#3fb950' : 'transparent'}`,
              color: tab === id ? '#e6edf3' : '#7d8fa3',
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Global Flags */}
      {tab === 'global' && (
        <div className="flex flex-col gap-3">
          {flags.length === 0 && (
            <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#7d8fa3' }}>
              No feature flags found. Create a feature_flags table and populate it.
            </div>
          )}
          {flags.map((flag) => (
            <div
              key={flag.id}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{ background: '#0d1117', border: `1px solid ${flag.enabled ? '#3fb95022' : '#1a2332'}` }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{flag.name}</p>
                  <Badge color={flag.enabled ? '#3fb950' : '#7d8fa3'}>{flag.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                {flag.description && (
                  <p className="text-xs" style={{ color: '#7d8fa3' }}>{flag.description}</p>
                )}
                {flag.updated_at && (
                  <p className="text-xs mt-1" style={{ color: '#7d8fa3' }}>
                    Updated {new Date(flag.updated_at).toLocaleDateString()}
                    {flag.updated_by && ` by ${flag.updated_by.slice(0, 8)}…`}
                  </p>
                )}
              </div>

              {confirmId === flag.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs" style={{ color: '#d29922' }}>Confirm disable?</span>
                  <Btn variant="danger" disabled={isPending} onClick={() => handleToggle(flag)}>Yes, disable</Btn>
                  <Btn variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Btn>
                </div>
              ) : (
                <button
                  onClick={() => handleToggle(flag)}
                  disabled={isPending}
                  className="px-4 py-1.5 rounded text-xs font-medium shrink-0 disabled:opacity-50"
                  style={{
                    background: flag.enabled ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.1)',
                    border: `1px solid ${flag.enabled ? '#f85149' : '#3fb950'}`,
                    color: flag.enabled ? '#f85149' : '#3fb950',
                  }}
                >
                  {flag.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-User Overrides */}
      {tab === 'user' && (
        <div className="flex flex-col gap-6">
          {/* Add override */}
          <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>
              Add Override
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ ...inp, width: 220, color: selectedUserId ? '#e6edf3' : '#7d8fa3' }}
              >
                <option value="">Select user…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</option>
                ))}
              </select>
              <select
                value={selectedFlag}
                onChange={(e) => setSelectedFlag(e.target.value)}
                style={{ ...inp, width: 200, color: selectedFlag ? '#e6edf3' : '#7d8fa3' }}
              >
                <option value="">Select flag…</option>
                {flags.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
              <select
                value={selectedEnabled ? 'true' : 'false'}
                onChange={(e) => setSelectedEnabled(e.target.value === 'true')}
                style={{ ...inp, width: 120 }}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
              <Btn variant="primary" disabled={isPending || !selectedUserId || !selectedFlag} onClick={handleAddOverride}>
                {isPending ? 'Saving…' : 'Set Override'}
              </Btn>
            </div>
          </div>

          {/* Overrides list */}
          {overrides.length === 0 ? (
            <div className="rounded-lg px-4 py-8 text-center text-xs" style={{ background: '#080b0f', border: '1px solid #1a2332', color: '#7d8fa3' }}>
              No per-user overrides set
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
                    {['User', 'Flag', 'State', 'Set At', ''].map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o, i) => (
                    <tr key={o.id} style={{ background: '#080b0f', borderBottom: i < overrides.length - 1 ? '1px solid #1a2332' : undefined }}>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#e6edf3' }}>
                        {profileMap.get(o.user_id) ?? o.user_id.slice(0, 8) + '…'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#bc8cff' }}>{o.flag_name}</td>
                      <td className="px-4 py-2.5">
                        <Badge color={o.enabled ? '#3fb950' : '#f85149'}>{o.enabled ? 'Enabled' : 'Disabled'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: '#7d8fa3' }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <Btn variant="danger" disabled={isPending} onClick={() => handleDeleteOverride(o)}>
                          Remove
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
