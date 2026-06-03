'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupportTicket, TicketReply } from '@/types/database'

async function getAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function updatePriority(ticketId: string, priority: string) {
  const admin = createAdminClient()
  await admin.from('support_tickets').update({ priority }).eq('id', ticketId)
  revalidatePath('/support')
}

export async function updateStatus(ticketId: string, status: string) {
  const admin = createAdminClient()
  await admin.from('support_tickets').update({ status }).eq('id', ticketId)
  revalidatePath('/support')
}

export async function assignTicket(ticketId: string, adminUserId: string) {
  const admin = createAdminClient()
  await admin.from('support_tickets').update({ assigned_to: adminUserId }).eq('id', ticketId)
  revalidatePath('/support')
}

export async function replyToTicket(ticketId: string, body: string) {
  const adminId = await getAdminId()
  if (!adminId) return
  const admin = createAdminClient()
  await admin.from('ticket_replies').insert({ ticket_id: ticketId, sender_id: adminId, body, is_admin: true })
}

export async function resolveTicket(ticketId: string) {
  const admin = createAdminClient()
  await admin.from('support_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', ticketId)
  revalidatePath('/support')
}

export async function deleteTicket(ticketId: string) {
  const admin = createAdminClient()
  await admin.from('support_tickets').delete().eq('id', ticketId)
  revalidatePath('/support')
}

export type TicketWithUser = SupportTicket & {
  user_name: string | null
  user_email: string | null
  user_plan: string | null
  user_stage: string | null
  assigned_name: string | null
}

export async function getTickets(): Promise<TicketWithUser[]> {
  const admin = createAdminClient()
  const { data: tickets } = await admin
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (!tickets?.length) return []

  const userIds = [...new Set([
    ...tickets.map(t => t.user_id),
    ...tickets.map(t => t.assigned_to),
  ].filter(Boolean))] as string[]

  // Use admin client to read other users' profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, username, email, plan, stage')
    .in('id', userIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  return tickets.map(t => ({
    ...(t as SupportTicket),
    user_name: t.user_id ? (profileMap.get(t.user_id)?.full_name ?? profileMap.get(t.user_id)?.username ?? null) : null,
    user_email: t.user_id ? profileMap.get(t.user_id)?.email ?? null : null,
    user_plan: t.user_id ? profileMap.get(t.user_id)?.plan ?? null : null,
    user_stage: t.user_id ? profileMap.get(t.user_id)?.stage ?? null : null,
    assigned_name: t.assigned_to ? (profileMap.get(t.assigned_to)?.full_name ?? profileMap.get(t.assigned_to)?.username ?? null) : null,
  }))
}

export type ReplyWithSender = TicketReply & { sender_name: string | null }

export async function getTicketReplies(ticketId: string): Promise<ReplyWithSender[]> {
  const admin = createAdminClient()
  const { data: replies } = await admin
    .from('ticket_replies')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (!replies?.length) return []

  const senderIds = [...new Set(replies.map(r => r.sender_id).filter(Boolean))] as string[]
  const { data: profiles } = await admin.from('profiles').select('id, full_name, username').in('id', senderIds)
  const nameMap = new Map(profiles?.map(p => [p.id, p.full_name ?? p.username]) ?? [])

  return replies.map(r => ({ ...(r as TicketReply), sender_name: r.sender_id ? (nameMap.get(r.sender_id) ?? null) : null }))
}

export async function getAdminUsers() {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('id, full_name, username').eq('is_admin', true)
  return data ?? []
}

export type SupportStats = {
  open: number
  inProgress: number
  resolvedToday: number
  avgResponseMs: number | null
}

export async function getSupportStats(): Promise<SupportStats> {
  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: open },
    { count: inProgress },
    { count: resolvedToday },
  ] = await Promise.all([
    admin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    admin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('resolved_at', todayStart.toISOString()),
  ])

  return { open: open ?? 0, inProgress: inProgress ?? 0, resolvedToday: resolvedToday ?? 0, avgResponseMs: null }
}
