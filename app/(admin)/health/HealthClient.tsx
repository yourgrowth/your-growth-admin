'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { resolveError, reportIncident, resolveIncident } from '@/app/actions/health'
import type { HealthStats, EdgeFunctionStat } from '@/app/actions/health'
import type { AppError, ServiceIncident } from '@/types/database'

const SERVICES = ['Supabase', 'RevenueCat', 'Mux', 'Anthropic API', 'Expo Push']

const T = { fontFamily: 'IBM Plex Mono, monospace' }

type Filter = 'All' | 'Unresolved' | 'Edge Functions' | 'Auth Errors'

type Props = {
  stats: HealthStats
  edgeStats: EdgeFunctionStat[]
  incidents: ServiceIncident[]
}

export default function HealthClient({ stats, edgeStats, incidents: initialIncidents }: Props) {
  const [errors, setErrors] = useState<AppError[]>([])
  const [incidents, setIncidents] = useState<ServiceIncident[]>(initialIncidents)
  const [filter, setFilter] = useState<Filter>('All')
  const [incidentModal, setIncidentModal] = useState<string | null>(null)
  const [incidentDesc, setIncidentDesc] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('app_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setErrors((data ?? []) as AppError[]))

    const channel = supabase
      .channel('app_errors_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_errors' }, (payload) => {
        setErrors(prev => [payload.new as AppError, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = errors.filter(e => {
    if (filter === 'Unresolved') return !e.resolved
    if (filter === 'Edge Functions') return !!e.edge_function
    if (filter === 'Auth Errors') return e.error_type === 'auth'
    return true
  })

  const affectedService = (name: string) => incidents.some(i => i.service_name === name)

  const inp: React.CSSProperties = {
    background: '#080b0f', border: '1px solid #1a2332', color: '#e6edf3',
    borderRadius: 4, padding: '6px 10px', fontSize: 13, ...T, width: '100%', outline: 'none',
  }

  return (
    <div className="flex flex-col gap-6" style={T}>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Errors Today" value={stats.totalErrorsToday} color="#f85149" />
        <StatCard label="Unresolved Errors" value={stats.unresolvedErrors} color="#d29922" />
        <StatCard label="Edge Function Failures" value={stats.edgeFunctionFailures} color="#bc8cff" />
        <StatCard label="Affected Users" value={stats.affectedUsers} color="#58a6ff" />
      </div>

      {/* Real-time error feed */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
            Real-time Error Feed
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: '#3fb950' }} />
              <span style={{ color: '#3fb950' }}>Live</span>
            </span>
          </p>
          <div className="flex gap-1">
            {(['All', 'Unresolved', 'Edge Functions', 'Auth Errors'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded text-xs"
                style={{
                  background: filter === f ? '#1a2332' : 'transparent',
                  color: filter === f ? '#e6edf3' : '#7d8fa3',
                  border: `1px solid ${filter === f ? '#1a2332' : 'transparent'}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0 max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs" style={{ color: '#7d8fa3', background: '#080b0f' }}>
              No errors match this filter.
            </div>
          ) : (
            filtered.map(error => (
              <div
                key={error.id}
                className="px-4 py-3 flex items-start gap-3"
                style={{ background: '#080b0f', borderBottom: '1px solid #1a2332', opacity: error.resolved ? 0.5 : 1 }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {error.error_type && <Badge color="#f85149">{error.error_type}</Badge>}
                    {error.edge_function && <Badge color="#bc8cff">{error.edge_function}</Badge>}
                    {error.resolved && <Badge color="#3fb950">Resolved</Badge>}
                  </div>
                  <p className="text-sm truncate" style={{ color: '#e6edf3' }}>{error.message ?? 'No message'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7d8fa3' }}>
                    {new Date(error.created_at).toLocaleString()}
                    {error.user_id && ` · User: ${error.user_id.slice(0, 8)}…`}
                  </p>
                </div>
                {!error.resolved && (
                  <button
                    onClick={() => startTransition(async () => {
                      await resolveError(error.id)
                      setErrors(prev => prev.map(e => e.id === error.id ? { ...e, resolved: true } : e))
                    })}
                    disabled={isPending}
                    className="px-2.5 py-1 rounded text-xs shrink-0 disabled:opacity-50"
                    style={{ background: 'transparent', border: '1px solid #3fb950', color: '#3fb950' }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edge function monitor */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
        <div className="px-4 py-3" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>Edge Function Monitor</p>
        </div>
        {edgeStats.length === 0 ? (
          <div className="px-4 py-6 text-xs text-center" style={{ color: '#7d8fa3', background: '#080b0f' }}>No edge function logs yet.</div>
        ) : (
          <table className="w-full text-sm" style={{ background: '#080b0f' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2332' }}>
                {['Function Name', 'Last Called', 'Avg Duration', 'Success Rate', 'Last Error'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7d8fa3' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {edgeStats.map(stat => (
                <tr key={stat.name} style={{ borderBottom: '1px solid #1a2332' }}>
                  <td className="px-4 py-3" style={{ color: '#e6edf3' }}>{stat.name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#7d8fa3' }}>{new Date(stat.lastCalled).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#7d8fa3' }}>{stat.avgDuration != null ? `${stat.avgDuration}ms` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium" style={{ color: stat.successRate >= 90 ? '#3fb950' : stat.successRate >= 70 ? '#d29922' : '#f85149' }}>
                      {stat.successRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs truncate max-w-48" style={{ color: stat.lastError ? '#f85149' : '#7d8fa3' }}>
                    {stat.lastError ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* System status */}
      <div className="rounded-lg p-5" style={{ background: '#0d1117', border: '1px solid #1a2332' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7d8fa3' }}>System Status</p>
        <div className="grid grid-cols-5 gap-3">
          {SERVICES.map(service => {
            const hasIncident = affectedService(service)
            const activeIncident = incidents.find(i => i.service_name === service)
            return (
              <div
                key={service}
                className="rounded-lg p-4 flex flex-col gap-2"
                style={{ background: '#080b0f', border: `1px solid ${hasIncident ? '#f85149' : '#1a2332'}` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: hasIncident ? '#f85149' : '#3fb950', boxShadow: `0 0 6px ${hasIncident ? '#f85149' : '#3fb950'}` }}
                  />
                  <p className="text-xs font-medium" style={{ color: '#e6edf3' }}>{service}</p>
                </div>
                <p className="text-xs" style={{ color: hasIncident ? '#f85149' : '#3fb950' }}>
                  {hasIncident ? 'Incident' : 'Operational'}
                </p>
                {hasIncident && activeIncident && (
                  <button
                    onClick={() => startTransition(async () => {
                      await resolveIncident(activeIncident.id)
                      setIncidents(prev => prev.filter(i => i.id !== activeIncident.id))
                    })}
                    disabled={isPending}
                    className="text-xs px-2 py-1 rounded disabled:opacity-50"
                    style={{ background: 'transparent', border: '1px solid #3fb950', color: '#3fb950' }}
                  >
                    Resolve
                  </button>
                )}
                {!hasIncident && (
                  <button
                    onClick={() => { setIncidentModal(service); setIncidentDesc('') }}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
                  >
                    Report Incident
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Incident modal */}
      {incidentModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 60, background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setIncidentModal(null)}
        >
          <div
            className="p-6 rounded-lg flex flex-col gap-4"
            style={{ background: '#0d1117', border: '1px solid #1a2332', width: 400, ...T }}
            onClick={e => e.stopPropagation()}
          >
            <p className="font-semibold" style={{ color: '#e6edf3' }}>Report Incident — {incidentModal}</p>
            <textarea
              placeholder="Describe the incident..."
              value={incidentDesc}
              onChange={e => setIncidentDesc(e.target.value)}
              rows={3}
              style={{ ...inp, resize: 'vertical' }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIncidentModal(null)}
                className="px-4 py-2 rounded text-sm"
                style={{ background: 'transparent', border: '1px solid #1a2332', color: '#7d8fa3' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!incidentDesc.trim()) return
                  startTransition(async () => {
                    await reportIncident(incidentModal, incidentDesc.trim())
                    const supabase = createClient()
                    const { data } = await supabase.from('service_incidents').select('*').is('resolved_at', null)
                    setIncidents((data ?? []) as ServiceIncident[])
                    setIncidentModal(null)
                  })
                }}
                disabled={isPending || !incidentDesc.trim()}
                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: '#f8514922', color: '#f85149', border: '1px solid #f85149' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
