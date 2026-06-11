'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { suspendUser, restoreUser, bulkSuspend, bulkGrantPro, bulkRevokePro } from '@/app/actions/users'
import type { UserWithEmail } from '@/components/UserDrawer'

const C = {
  bg: '#070a0e', surface: '#0d1117', surface2: '#0f1722', elevated: '#111a26',
  dim: '#1a2332', dim2: '#243044', text: '#e6edf3', muted: '#7d8fa3', muted2: '#5a6b7d',
  green: '#3fb950', blue: '#58a6ff', purple: '#bc8cff', amber: '#d29922', red: '#f85149',
}

function exportCSV() { window.location.href = '/api/export?table=users' }
function exportSelected(selected: UserWithEmail[]) {
  const headers = ['id','full_name','email','plan','stage','streak','points','status','created_at']
  const escape = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s }
  const csv = [headers.join(','), ...selected.map(u => headers.map(h => escape(u[h as keyof UserWithEmail])).join(','))].join('\n')
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: 'users_selected.csv' })
  a.click()
}

function getRiskLabel(s: number) { return s <= 2 ? 'Low' : s <= 5 ? 'Med' : 'High' }
function getRiskColor(s: number) { return s <= 2 ? C.green : s <= 5 ? C.amber : C.red }

function Avatar({ name, plan }: { name: string; plan?: string | null }) {
  const initial = name?.[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      background: plan?.toLowerCase() === 'pro' ? 'rgba(188,140,255,0.15)' : 'rgba(63,185,80,0.12)',
      border: `1px solid ${plan?.toLowerCase() === 'pro' ? C.purple + '44' : C.green + '44'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: plan?.toLowerCase() === 'pro' ? C.purple : C.green,
    }}>
      {initial}
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      background: color + '22', color, border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  )
}

function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono, monospace)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

type Filter = 'all' | 'pro' | 'free' | 'suspended' | 'high-risk'
type AdvancedFilters = { plan: string; stage: string; minStreak: string; maxStreak: string; lastActiveWithin: string; riskLevel: string }
const EMPTY_ADV: AdvancedFilters = { plan: '', stage: '', minStreak: '', maxStreak: '', lastActiveWithin: '', riskLevel: '' }

export default function UsersClient({ users }: { users: UserWithEmail[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADV)

  const distinctStages = useMemo(
    () => [...new Set(users.map(u => u.stage).filter(Boolean) as string[])].sort(),
    [users],
  )

  const advCount = Object.values(advanced).filter(Boolean).length
  const setAdv = (k: keyof AdvancedFilters, v: string) => setAdvanced(p => ({ ...p, [k]: v }))

  const filtered = useMemo(() => {
    let list = users
    if (filter === 'pro') list = list.filter(u => (u.plan ?? '').toLowerCase() === 'pro')
    else if (filter === 'free') list = list.filter(u => (u.plan ?? '').toLowerCase() !== 'pro')
    else if (filter === 'suspended') list = list.filter(u => u.status === 'suspended')
    else if (filter === 'high-risk') list = list.filter(u => u.riskScore >= 6)
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(u => u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) }
    if (advanced.plan === 'pro') list = list.filter(u => (u.plan ?? '').toLowerCase() === 'pro')
    else if (advanced.plan === 'free') list = list.filter(u => (u.plan ?? '').toLowerCase() !== 'pro')
    if (advanced.stage) list = list.filter(u => u.stage === advanced.stage)
    if (advanced.minStreak !== '') list = list.filter(u => (u.streak ?? 0) >= Number(advanced.minStreak))
    if (advanced.maxStreak !== '') list = list.filter(u => (u.streak ?? 0) <= Number(advanced.maxStreak))
    if (advanced.lastActiveWithin) { const cutoff = Date.now() - Number(advanced.lastActiveWithin) * 86400000; list = list.filter(u => u.last_sign_in_at != null && new Date(u.last_sign_in_at).getTime() >= cutoff) }
    if (advanced.riskLevel === 'low') list = list.filter(u => u.riskScore <= 2)
    else if (advanced.riskLevel === 'medium') list = list.filter(u => u.riskScore >= 3 && u.riskScore <= 5)
    else if (advanced.riskLevel === 'high') list = list.filter(u => u.riskScore >= 6)
    return list
  }, [users, filter, search, advanced])

  const allChecked = filtered.length > 0 && filtered.every(u => selected.has(u.id))
  const someChecked = filtered.some(u => selected.has(u.id))
  const toggleAll = () => setSelected(p => { const n = new Set(p); allChecked ? filtered.forEach(u => n.delete(u.id)) : filtered.forEach(u => n.add(u.id)); return n })
  const toggleOne = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectedIds = [...selected]
  const selectedList = users.filter(u => selected.has(u.id))

  const highRisk = users.filter(u => u.riskScore >= 6).length
  const suspended = users.filter(u => u.status === 'suspended').length
  const pro = users.filter(u => (u.plan ?? '').toLowerCase() === 'pro').length

  const inp: React.CSSProperties = { background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 7, color: C.text, padding: '8px 12px', fontSize: 13, outline: 'none' }

  const FILTERS: { label: string; value: Filter; color?: string }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pro', value: 'pro', color: C.purple },
    { label: 'Free', value: 'free' },
    { label: 'Suspended', value: 'suspended', color: C.amber },
    { label: 'High Risk', value: 'high-risk', color: C.red },
  ]

  return (
    <div>
      {/* KPI stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile label="Total Members" value={users.length.toLocaleString()} color={C.green} sub="registered accounts" />
        <StatTile label="Pro" value={pro.toLocaleString()} color={C.purple} sub={`${Math.round(pro / Math.max(users.length, 1) * 100)}% conversion`} />
        <StatTile label="High Risk" value={highRisk} color={C.red} sub="churn / disengaged" />
        <StatTile label="Suspended" value={suspended} color={C.amber} sub="access restricted" />
      </div>

      {/* Search + filters row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          style={{ ...inp, width: 280 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === f.value ? C.dim : 'transparent',
              color: filter === f.value ? (f.color ?? C.text) : C.muted,
              border: `1px solid ${filter === f.value ? (f.color ? f.color + '66' : C.green + '66') : C.dim}`,
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdvanced(v => !v)} style={{
          ...inp, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          color: advCount > 0 ? C.green : C.muted,
          border: `1px solid ${advCount > 0 ? C.green + '66' : C.dim}`,
          background: showAdvanced ? C.dim : C.surface,
        }}>
          Advanced {advCount > 0 && <span style={{ background: C.green, color: C.bg, borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{advCount}</span>}
        </button>
        {advCount > 0 && <button onClick={() => setAdvanced(EMPTY_ADV)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Clear</button>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={exportCSV} style={{ ...inp, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.muted }}>Export CSV</button>
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div style={{ background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 16, marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { key: 'plan', label: 'Plan', options: [['','Any'],['pro','Pro'],['free','Free']] },
            { key: 'riskLevel', label: 'Risk Level', options: [['','Any'],['low','Low (0–2)'],['medium','Medium (3–5)'],['high','High (6+)']] },
            { key: 'lastActiveWithin', label: 'Last Active Within', options: [['','Any time'],['1','1 day'],['7','7 days'],['30','30 days'],['90','90 days']] },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6 }}>{f.label}</label>
              <select value={advanced[f.key as keyof AdvancedFilters]} onChange={e => setAdv(f.key as keyof AdvancedFilters, e.target.value)} style={{ ...inp, width: '100%' }}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6 }}>Stage</label>
            <select value={advanced.stage} onChange={e => setAdv('stage', e.target.value)} style={{ ...inp, width: '100%' }}>
              <option value="">Any</option>
              {distinctStages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6 }}>Min Streak</label>
            <input type="number" min={0} value={advanced.minStreak} onChange={e => setAdv('minStreak', e.target.value)} placeholder="0" style={{ ...inp, width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6 }}>Max Streak</label>
            <input type="number" min={0} value={advanced.maxStreak} onChange={e => setAdv('maxStreak', e.target.value)} placeholder="∞" style={{ ...inp, width: '100%' }} />
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {someChecked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 9, background: C.surface, border: `1px solid ${C.dim}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{selected.size} selected</span>
          <button disabled={isPending} onClick={() => startTransition(async () => { await bulkSuspend(selectedIds); setSelected(new Set()) })} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}>Suspend</button>
          <button disabled={isPending} onClick={() => startTransition(async () => { await bulkGrantPro(selectedIds); setSelected(new Set()) })} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.purple + '22', color: C.purple, border: `1px solid ${C.purple}44` }}>Grant Pro</button>
          <button disabled={isPending} onClick={() => startTransition(async () => { await bulkRevokePro(selectedIds); setSelected(new Set()) })} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.dim, color: C.muted, border: `1px solid ${C.dim2}` }}>Revoke Pro</button>
          <button onClick={() => exportSelected(selectedList)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.blue + '22', color: C.blue, border: `1px solid ${C.blue}44` }}>Export</button>
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.dim}` }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ background: C.surface, borderBottom: `1px solid ${C.dim}` }}>
              <th style={{ padding: '12px 16px', width: 36 }}>
                <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked }} onChange={toggleAll} style={{ accentColor: C.green, cursor: 'pointer' }} />
              </th>
              {['Member','Plan','Stage','Streak','Points','Status','Risk',''].map(col => (
                <th key={col} style={{ padding: '12px 16px', textAlign: col === 'Streak' || col === 'Points' ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, background: C.bg }}>
                  No users found
                </td>
              </tr>
            )}
            {filtered.map((user, i) => {
              const isSuspended = user.status === 'suspended'
              const isSelected = selected.has(user.id)
              const isPro = (user.plan ?? '').toLowerCase() === 'pro'
              return (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/users/${user.id}`)}
                  style={{
                    background: isSelected ? '#1a233280' : C.bg,
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.dim}` : undefined,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = C.bg }}
                >
                  <td style={{ padding: '12px 16px', width: 36 }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(user.id)} style={{ accentColor: C.green, cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={user.full_name ?? user.email} plan={user.plan} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge color={isPro ? C.purple : C.muted}>{user.plan ?? 'free'}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.muted, whiteSpace: 'nowrap' }}>{user.stage ?? '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.green, fontFamily: 'monospace', fontWeight: 600 }}>{user.streak ?? 0}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.blue, fontFamily: 'monospace', fontWeight: 600 }}>{(user.points ?? 0).toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge color={isSuspended ? C.red : C.green}>{user.status ?? 'active'}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge color={getRiskColor(user.riskScore)}>{getRiskLabel(user.riskScore)} · {user.riskScore}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => router.push(`/users/${user.id}`)}
                        style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.dim2}`, color: C.muted }}
                      >
                        View
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => startTransition(async () => { await (isSuspended ? restoreUser(user.id) : suspendUser(user.id)) })}
                        style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: isSuspended ? 'transparent' : C.red + '22', border: `1px solid ${isSuspended ? C.dim2 : C.red + '44'}`, color: isSuspended ? C.muted : C.red }}
                      >
                        {isSuspended ? 'Restore' : 'Suspend'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
