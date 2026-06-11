import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import FeatureFlagsClient from './FeatureFlagsClient'

export default async function FeatureFlagsPage() {
  const supabase = createAdminClient()

  const [flagsResult, overridesResult, profilesResult] = await Promise.allSettled([
    supabase.from('feature_flags').select('*').order('name', { ascending: true }),
    supabase.from('user_feature_flags').select('*'),
    supabase.from('profiles').select('id, full_name'),
  ])

  type FlagRow = { id: string; name: string; enabled: boolean; description: string | null; updated_at: string | null; updated_by: string | null }
  type OverrideRow = { id: string; user_id: string; flag_name: string; enabled: boolean; created_at: string }
  const flags = flagsResult.status === 'fulfilled' ? ((flagsResult.value.data ?? []) as unknown as FlagRow[]) : []
  const overrides = overridesResult.status === 'fulfilled' ? ((overridesResult.value.data ?? []) as unknown as OverrideRow[]) : []
  const profiles = profilesResult.status === 'fulfilled' ? (profilesResult.value.data ?? []) : []

  return (
    <div>
      <PageHeader title="Feature Flags" subtitle="Global toggles and per-user overrides" />
      <FeatureFlagsClient flags={flags} overrides={overrides} profiles={profiles} />
    </div>
  )
}
