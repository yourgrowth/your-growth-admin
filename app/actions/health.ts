'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppError, ServiceIncident } from '@/types/database'

async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function auditLog(adminId: string, action: string) {
  const admin = createAdminClient()
  await admin.from('admin_audit_log').insert({ admin_id: adminId, action, metadata: {} })
}

export async function resolveError(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('app_errors').update({ resolved: true }).eq('id', id)
  await auditLog(adminId, `resolve_error:${id}`)
  revalidatePath('/health')
}

export async function reportIncident(serviceName: string, description: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('service_incidents').insert({ service_name: serviceName, description })
  await auditLog(adminId, `report_incident:${serviceName}`)
  revalidatePath('/health')
}

export async function resolveIncident(id: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('service_incidents').update({ resolved_at: new Date().toISOString() }).eq('id', id)
  await auditLog(adminId, `resolve_incident:${id}`)
  revalidatePath('/health')
}

export async function getRecentErrors(): Promise<AppError[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('app_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as AppError[]
}

export type EdgeFunctionStat = {
  name: string
  lastCalled: string
  avgDuration: number | null
  successRate: number
  lastError: string | null
  total: number
}

export async function getEdgeFunctionStats(): Promise<EdgeFunctionStat[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('edge_function_logs')
    .select('function_name, status, duration_ms, error_message, created_at')
    .order('created_at', { ascending: false })

  const logs = data ?? []
  const byFn = new Map<string, {
    lastCalled: string; durations: number[]; total: number; successes: number; lastError: string | null
  }>()

  for (const log of logs) {
    const name = log.function_name ?? 'unknown'
    const entry = byFn.get(name) ?? { lastCalled: log.created_at, durations: [], total: 0, successes: 0, lastError: null }
    entry.total++
    if (log.status === 'success') entry.successes++
    if (log.duration_ms) entry.durations.push(log.duration_ms)
    if (log.error_message && !entry.lastError) entry.lastError = log.error_message
    if (log.created_at > entry.lastCalled) entry.lastCalled = log.created_at
    byFn.set(name, entry)
  }

  return Array.from(byFn.entries()).map(([name, e]) => ({
    name,
    lastCalled: e.lastCalled,
    avgDuration: e.durations.length > 0 ? Math.round(e.durations.reduce((a, b) => a + b, 0) / e.durations.length) : null,
    successRate: e.total > 0 ? Math.round((e.successes / e.total) * 100) : 100,
    lastError: e.lastError,
    total: e.total,
  }))
}

export async function getActiveIncidents(): Promise<ServiceIncident[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('service_incidents').select('*').is('resolved_at', null)
  return (data ?? []) as ServiceIncident[]
}

export type HealthStats = {
  totalErrorsToday: number
  unresolvedErrors: number
  edgeFunctionFailures: number
  affectedUsers: number
}

export async function getHealthStats(): Promise<HealthStats> {
  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: totalErrorsToday },
    { count: unresolvedErrors },
    { data: failures },
    { data: affectedData },
  ] = await Promise.all([
    admin.from('app_errors').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    admin.from('app_errors').select('*', { count: 'exact', head: true }).eq('resolved', false),
    admin.from('edge_function_logs').select('id').eq('status', 'error').gte('created_at', todayStart.toISOString()),
    admin.from('app_errors').select('user_id').eq('resolved', false).not('user_id', 'is', null),
  ])

  const affectedUsers = new Set(affectedData?.map(e => e.user_id)).size

  return {
    totalErrorsToday: totalErrorsToday ?? 0,
    unresolvedErrors: unresolvedErrors ?? 0,
    edgeFunctionFailures: failures?.length ?? 0,
    affectedUsers,
  }
}
