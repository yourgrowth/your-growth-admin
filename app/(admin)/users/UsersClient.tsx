'use client'

import { useState, useMemo, useTransition } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Btn from '@/components/ui/Btn'
import UserDrawer, { type UserWithEmail } from '@/components/UserDrawer'
import { suspendUser, restoreUser, bulkSuspend, bulkGrantPro, bulkRevokePro } from '@/app/actions/users'

function exportCSV() {
  window.location.href = '/api/export?table=users'
}

function exportSelected(selected: UserWithEmail[]) {
  const headers = ['id', 'full_name', 'email', 'plan', 'stage', 'streak', 'points', 'status', 'created_at']
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...selected.map((u) => headers.map((h) => escape(u[h as keyof UserWithEmail])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'users_selected.csv'
  a.click()
  URL.revokeObjectURL(url)
}

type Props = {
  users: UserWithEmail[]
}

type Filter = 'all' | 'pro' | 'free' | 'suspended' | 'high-risk'

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pro', value: 'pro' },
  { label: 'Free', value: 'free' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'High Risk', value: 'high-risk' },
]

type AdvancedFilters = {
  plan: string
  stage: string
  minStreak: string
  maxStreak: string
  lastActiveWithin: string
  riskLevel: string
}

const EMPTY_ADVANCED: AdvancedFilters = {
  plan: '',
  stage: '',
  minStreak: '',
  maxStreak: '',
  lastActiveWithin: '',
  riskLevel: '',
}

function getRiskLabel(score: number) {
  if (score <= 2) return 'Low'
  if (score <= 5) return 'Medium'
  return 'High'
}

function getRiskColor(score: number) {
  if (score <= 2) return '#3fb950'
  if (score <= 5) return '#d29922'
  return '#f85149'
}

const fieldStyle = {
  background: '#080b0f',
  border: '1px solid #1a2332',
  color: '#e6edf3',
} as const

const COLS = ['User', 'Plan', 'Stage', 'Streak', 'Points', 'Status', 'Risk', 'Actions']

export default function UsersClient({ users }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedUser, setSelectedUser] = useState<UserWithEmail | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED)

  const distinctStages = useMemo(
    () => [...new Set(users.map((u) => u.stage).filter(Boolean) as string[])].sort(),
    [users],
  )

  const activeAdvancedCount = Object.values(advanced).filter(Boolean).length

  function setAdv(key: keyof AdvancedFilters, value: string) {
    setAdvanced((prev) => ({ ...prev, [key]: value }))
  }

  const filtered = useMemo(() => {
    let list = users

    if (filter === 'pro') list = list.filter((u) => (u.plan ?? '').toLowerCase() === 'pro')
    else if (filter === 'free') list = list.filter((u) => (u.plan ?? '').toLowerCase() !== 'pro')
    else if (filter === 'suspended') list = list.filter((u) => u.status === 'suspended')
    else if (filter === 'high-risk') list = list.filter((u) => u.riskScore >= 6)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) => u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    }

    if (advanced.plan) {
      if (advanced.plan === 'pro') list = list.filter((u) => (u.plan ?? '').toLowerCase() === 'pro')
      else list = list.filter((u) => (u.plan ?? '').toLowerCase() !== 'pro')
    }
    if (advanced.stage) {
      list = list.filter((u) => u.stage === advanced.stage)
    }
    if (advanced.minStreak !== '') {
      const min = Number(advanced.minStreak)
      list = list.filter((u) => (u.streak ?? 0) >= min)
    }
    if (advanced.maxStreak !== '') {
      const max = Number(advanced.maxStreak)
      list = list.filter((u) => (u.streak ?? 0) <= max)
    }
    if (advanced.lastActiveWithin) {
      const days = Number(advanced.lastActiveWithin)
      const cutoff = Date.now() - days * 86400000
      list = list.filter(
        (u) => u.last_sign_in_at != null && new Date(u.last_sign_in_at).getTime() >= cutoff,
      )
    }
    if (advanced.riskLevel === 'low') list = list.filter((u) => u.riskScore <= 2)
    else if (advanced.riskLevel === 'medium')
      list = list.filter((u) => u.riskScore >= 3 && u.riskScore <= 5)
    else if (advanced.riskLevel === 'high') list = list.filter((u) => u.riskScore >= 6)

    return list
  }, [users, filter, search, advanced])

  const allChecked = filtered.length > 0 && filtered.every((u) => selected.has(u.id))
  const someChecked = filtered.some((u) => selected.has(u.id))

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) filtered.forEach((u) => next.delete(u.id))
      else filtered.forEach((u) => next.add(u.id))
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedIds = [...selected]
  const selectedUserList = users.filter((u) => selected.has(u.id))

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users.length} total users`} />

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded px-3 py-2 text-sm outline-none"
            style={{ background: '#0d1117', border: '1px solid #1a2332', color: '#e6edf3' }}
          />
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
            style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
            style={{
              background: showAdvanced ? '#1a2332' : 'transparent',
              border: `1px solid ${activeAdvancedCount > 0 ? '#3fb950' : '#1a2332'}`,
              color: activeAdvancedCount > 0 ? '#3fb950' : '#7d8fa3',
            }}
          >
            Advanced Filter
            {activeAdvancedCount > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                style={{ background: '#3fb950', color: '#080b0f' }}
              >
                {activeAdvancedCount}
              </span>
            )}
          </button>
          {activeAdvancedCount > 0 && (
            <button
              onClick={() => setAdvanced(EMPTY_ADVANCED)}
              className="text-xs cursor-pointer"
              style={{ color: '#7d8fa3' }}
            >
              Clear
            </button>
          )}
        </div>

        {showAdvanced && (
          <div
            className="rounded-lg p-4 grid grid-cols-3 gap-4"
            style={{ background: '#0d1117', border: '1px solid #1a2332' }}
          >
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Plan</label>
              <select
                value={advanced.plan}
                onChange={(e) => setAdv('plan', e.target.value)}
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              >
                <option value="">Any</option>
                <option value="pro">Pro</option>
                <option value="free">Free</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Stage</label>
              <select
                value={advanced.stage}
                onChange={(e) => setAdv('stage', e.target.value)}
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              >
                <option value="">Any</option>
                {distinctStages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Risk Level</label>
              <select
                value={advanced.riskLevel}
                onChange={(e) => setAdv('riskLevel', e.target.value)}
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              >
                <option value="">Any</option>
                <option value="low">Low (0–2)</option>
                <option value="medium">Medium (3–5)</option>
                <option value="high">High (6+)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Min Streak</label>
              <input
                type="number"
                min={0}
                value={advanced.minStreak}
                onChange={(e) => setAdv('minStreak', e.target.value)}
                placeholder="0"
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Max Streak</label>
              <input
                type="number"
                min={0}
                value={advanced.maxStreak}
                onChange={(e) => setAdv('maxStreak', e.target.value)}
                placeholder="∞"
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#7d8fa3' }}>Last Active Within</label>
              <select
                value={advanced.lastActiveWithin}
                onChange={(e) => setAdv('lastActiveWithin', e.target.value)}
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              >
                <option value="">Any time</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{
                background: filter === value ? '#1a2332' : 'transparent',
                color:
                  filter === value
                    ? value === 'high-risk' ? '#f85149' : '#e6edf3'
                    : '#7d8fa3',
                border: `1px solid ${filter === value ? (value === 'high-risk' ? '#f85149' : '#3fb950') : '#1a2332'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {someChecked && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg mb-4 flex-wrap"
          style={{ background: '#0d1117', border: '1px solid #1a2332' }}
        >
          <span className="text-xs font-medium" style={{ color: '#e6edf3' }}>
            {selected.size} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={isPending}
              onClick={() => startTransition(async () => { await bulkSuspend(selectedIds); setSelected(new Set()) })}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{ background: '#f8514922', color: '#f85149', border: '1px solid #f8514944' }}
            >
              Suspend All
            </button>
            <button
              disabled={isPending}
              onClick={() => startTransition(async () => { await bulkGrantPro(selectedIds); setSelected(new Set()) })}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{ background: '#bc8cff22', color: '#bc8cff', border: '1px solid #bc8cff44' }}
            >
              Grant Pro
            </button>
            <button
              disabled={isPending}
              onClick={() => startTransition(async () => { await bulkRevokePro(selectedIds); setSelected(new Set()) })}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{ background: '#1a2332', color: '#7d8fa3', border: '1px solid #1a2332' }}
            >
              Revoke Pro
            </button>
            <button
              onClick={() => exportSelected(selectedUserList)}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              style={{ background: '#58a6ff22', color: '#58a6ff', border: '1px solid #58a6ff44' }}
            >
              Export Selected
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #1a2332' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                  onChange={toggleAll}
                  className="cursor-pointer"
                  style={{ accentColor: '#3fb950' }}
                />
              </th>
              {COLS.map((col) => (
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
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={COLS.length + 1}
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: '#7d8fa3', background: '#080b0f' }}
                >
                  No users found
                </td>
              </tr>
            )}
            {filtered.map((user, i) => {
              const isSuspended = user.status === 'suspended'
              const isSelected = selected.has(user.id)
              return (
                <tr
                  key={user.id}
                  style={{
                    background: isSelected ? '#1a233280' : '#080b0f',
                    borderBottom: i < filtered.length - 1 ? '1px solid #1a2332' : undefined,
                  }}
                >
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(user.id)}
                      className="cursor-pointer"
                      style={{ accentColor: '#3fb950' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                        style={{ background: '#1a2332', color: '#3fb950' }}
                      >
                        {(user.full_name ?? user.email)[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: '#e6edf3' }}>
                          {user.full_name ?? '—'}
                        </p>
                        <p className="text-xs truncate" style={{ color: '#7d8fa3' }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={(user.plan ?? '').toLowerCase() === 'pro' ? '#bc8cff' : '#7d8fa3'}>
                      {user.plan ?? 'free'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#e6edf3' }}>
                    {user.stage ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#3fb950' }}>
                    {user.streak ?? 0}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#58a6ff' }}>
                    {user.points ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={isSuspended ? '#f85149' : '#3fb950'}>
                      {user.status ?? 'active'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={getRiskColor(user.riskScore)}>
                      {getRiskLabel(user.riskScore)} · {user.riskScore}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Btn variant="ghost" onClick={() => setSelectedUser(user)}>
                        View
                      </Btn>
                      <Btn
                        variant={isSuspended ? 'ghost' : 'danger'}
                        onClick={() =>
                          startTransition(async () => {
                            await (isSuspended ? restoreUser(user.id) : suspendUser(user.id))
                          })
                        }
                        disabled={isPending}
                      >
                        {isSuspended ? 'Restore' : 'Suspend'}
                      </Btn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}
