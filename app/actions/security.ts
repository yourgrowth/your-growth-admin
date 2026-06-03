'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    '127.0.0.1'
  )
}

export async function logLoginAttempt(
  email: string,
  success: boolean,
): Promise<{ failureCount: number }> {
  const ip = await getClientIp()
  const admin = createAdminClient()

  await admin.from('login_attempts').insert({ ip_address: ip, email, success })

  if (success) return { failureCount: 0 }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('attempted_at', cutoff)

  return { failureCount: count ?? 0 }
}

export async function logAdminLogin(
  adminId: string,
  userAgent: string,
): Promise<string | null> {
  const ip = await getClientIp()
  const admin = createAdminClient()

  const { data } = await admin
    .from('admin_login_log')
    .insert({ admin_id: adminId, ip_address: ip, user_agent: userAgent })
    .select('id')
    .single()

  return data?.id ?? null
}

export async function getAdminSessions() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_login_log')
    .select('*')
    .eq('admin_id', user.id)
    .order('logged_in_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function getLoginAttempts() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('login_attempts')
    .select('*')
    .order('attempted_at', { ascending: false })
    .limit(100)

  return data ?? []
}

export async function signOutAllSessions(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  await admin.auth.admin.signOut(user.id, 'global')
  await admin
    .from('admin_login_log')
    .update({ logged_out_at: new Date().toISOString() })
    .eq('admin_id', user.id)
    .is('logged_out_at', null)

  return { error: null }
}
