import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SettingsClient from './SettingsClient'
import type { FeatureFlag } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const [{ data: flags }, { data: adminProfiles }, { data: listData }] = await Promise.all([
    supabase.from('feature_flags').select('*').order('key'),
    supabase.from('profiles').select('id, full_name, email, created_at').eq('is_admin', true),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailMap = new Map<string, string>()
  listData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email)
  })

  const admins = (adminProfiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap.get(p.id) ?? p.email ?? '',
    created_at: p.created_at,
  }))

  return <SettingsClient flags={(flags ?? []) as FeatureFlag[]} admins={admins} />
}
