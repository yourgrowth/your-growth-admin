import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client WITHOUT the generated `Database` generic.
 *
 * The generic CRUD framework (`app/actions/resources.ts`) needs to query
 * arbitrary tables by name. The typed `createAdminClient()` only knows about
 * tables present in `types/database.ts`, so `.from('mastery_pillars')` etc.
 * would be a type error there. This client is intentionally untyped so the
 * resource framework can address every table in the database.
 *
 * Never expose this to the browser — it carries the service-role key and
 * bypasses RLS. Only import it from `'use server'` action files.
 */
export function genericAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
