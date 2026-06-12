import LayoutShell from '@/components/LayoutShell'

// Admin pages fetch live data from Supabase and sit behind auth — they must be
// rendered per-request, never prerendered at build time. Without this, pages
// using createAdminClient get statically generated during `next build`, which
// hits Supabase at build time and fails on Vercel. Cascades to all (admin) routes.
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <LayoutShell>{children}</LayoutShell>
}
