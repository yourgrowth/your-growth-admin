import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/ui/PageHeader'
import SafetyClient from './SafetyClient'

export default async function SafetyPage() {
  const supabase = createAdminClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const lastMonthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  type SafetyFlag = {
    id: string; user_id: string | null; layer_caught: string | null
    trigger_type: string | null; input_snippet: string | null; response_given: string | null
    created_at: string; source: string | null; action_taken: string | null; trigger_text: string | null
    session_id: string | null; reviewed_at: string | null; reviewed_by: string | null
    original_response: string | null
  }
  type SafetyProfile = { id: string; full_name: string | null; country_code: string | null; email?: string | null; subscription_status?: string | null }
  type CountryRow = { country_code: string | null }

  const [
    flagsResult,
    profilesResult,
    totalFlagsResult,
    lastMonthFlagsResult,
    thisMonthFlagsResult,
    countriesResult,
  ] = await Promise.allSettled([
    Promise.resolve(supabase.from('safety_flag_log').select('*').order('created_at', { ascending: false }).limit(500)).catch(() => ({ data: null })) as Promise<{ data: SafetyFlag[] | null }>,
    Promise.resolve(supabase.from('profiles').select('id, full_name, country_code, subscription_status')).catch(() => ({ data: null })) as unknown as Promise<{ data: SafetyProfile[] | null }>,
    Promise.resolve(supabase.from('safety_flag_log').select('*', { count: 'exact', head: true }).eq('layer_caught', 'crisis')).catch(() => ({ count: 0 })) as unknown as Promise<{ count: number | null }>,
    Promise.resolve(supabase.from('safety_flag_log').select('*', { count: 'exact', head: true }).eq('layer_caught', 'crisis').gte('created_at', lastMonthStart).lt('created_at', thirtyDaysAgo)).catch(() => ({ count: 0 })) as unknown as Promise<{ count: number | null }>,
    Promise.resolve(supabase.from('safety_flag_log').select('*', { count: 'exact', head: true }).eq('layer_caught', 'crisis').gte('created_at', thirtyDaysAgo)).catch(() => ({ count: 0 })) as unknown as Promise<{ count: number | null }>,
    Promise.resolve(supabase.from('profiles').select('country_code').not('country_code', 'is', null)).catch(() => ({ data: null })) as unknown as Promise<{ data: CountryRow[] | null }>,
  ])

  const flags = flagsResult.status === 'fulfilled' ? (flagsResult.value.data ?? []) : []
  const profiles = profilesResult.status === 'fulfilled' ? (profilesResult.value.data ?? []) : []
  const totalCrisisAllTime = totalFlagsResult.status === 'fulfilled' ? (totalFlagsResult.value.count ?? 0) : 0
  const lastMonthCrisis = lastMonthFlagsResult.status === 'fulfilled' ? (lastMonthFlagsResult.value.count ?? 0) : 0
  const thisMonthCrisis = thisMonthFlagsResult.status === 'fulfilled' ? (thisMonthFlagsResult.value.count ?? 0) : 0
  const countryRows = countriesResult.status === 'fulfilled' ? (countriesResult.value.data ?? []) : []

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  // Country coverage check
  const COVERED_COUNTRIES = new Set(['AU', 'US', 'GB', 'NZ', 'CA', 'IE', 'ZA', 'IN', 'SG'])
  const countryCount: Record<string, number> = {}
  for (const row of countryRows) {
    const cc = row.country_code
    if (cc) countryCount[cc] = (countryCount[cc] ?? 0) + 1
  }

  const countryList = Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({
      code,
      count,
      covered: COVERED_COUNTRIES.has(code.toUpperCase()),
    }))

  const flagsWithUser = flags.map((f) => {
    const prof = profileMap.get(f.user_id ?? '')
    return {
      id: f.id,
      user_id: f.user_id ?? '',
      source: f.source ?? null,
      layer_caught: f.layer_caught ?? null,
      action_taken: f.action_taken ?? null,
      trigger_text: f.trigger_text ?? f.input_snippet ?? null,
      created_at: f.created_at,
      original_response: f.original_response ?? f.response_given ?? null,
      session_id: f.session_id ?? null,
      reviewed_at: f.reviewed_at ?? null,
      reviewed_by: f.reviewed_by ?? null,
      user_name: prof?.full_name ?? null,
      user_plan: prof?.subscription_status ?? null,
      country_code: prof?.country_code ?? null,
    }
  })

  const unreviewedCrisisCount = flagsWithUser.filter(
    (f) => f.layer_caught === 'crisis' && !f.reviewed_at
  ).length

  return (
    <div>
      <PageHeader title="Safety" subtitle="Crisis events, safety flags, and safeguarding overview" />
      <SafetyClient
        flags={flagsWithUser}
        totalCrisisAllTime={totalCrisisAllTime}
        lastMonthCrisis={lastMonthCrisis}
        thisMonthCrisis={thisMonthCrisis}
        countryList={countryList}
        unreviewedCrisisCount={unreviewedCrisisCount}
      />
    </div>
  )
}
