import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import AiUsageClient from './AiUsageClient'

export default async function AiUsagePage() {
  const supabase = createAdminClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    logsResult,
    profilesResult,
    chatMessagesResult,
  ] = await Promise.allSettled([
    supabase
      .from('ai_usage_log')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, display_name, subscription_status'),
    supabase
      .from('gardener_chat_messages')
      .select('session_id, role, created_at, content')
      .gte('created_at', thirtyDaysAgo),
  ])

  const logs = logsResult.status === 'fulfilled' ? (logsResult.value.data ?? []) : []
  const profiles = profilesResult.status === 'fulfilled' ? (profilesResult.value.data ?? []) : []
  const chatMessages = chatMessagesResult.status === 'fulfilled' ? (chatMessagesResult.value.data ?? []) : []

  return (
    <div>
      <PageHeader title="AI Usage" subtitle="Claude API cost and usage across all features" />
      <AiUsageClient logs={logs} profiles={profiles} chatMessages={chatMessages} />
    </div>
  )
}
