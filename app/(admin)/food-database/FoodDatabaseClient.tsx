'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { C, ToastProvider } from './_ui'
import OverviewTab from './tabs/OverviewTab'
import ProductsTab from './tabs/ProductsTab'
import QualityTab from './tabs/QualityTab'
import EnrichmentTab from './tabs/EnrichmentTab'
import SettingsTab from './tabs/SettingsTab'
import SubmissionsTab from './tabs/SubmissionsTab'
import type { OverviewStats, ProductsResult } from '@/app/actions/foodDatabase'
import type { ScraperRun } from '@/types/database'

type Tab = 'overview' | 'products' | 'submissions' | 'quality' | 'enrichment' | 'settings'
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['products', 'Products'],
  ['submissions', 'Submissions'],
  ['quality', 'Quality'],
  ['enrichment', 'Enrichment'],
  ['settings', 'Settings'],
]

export default function FoodDatabaseClient({
  initialStats, initialRuns, brands, initialProducts, pendingSubmissions,
}: {
  initialStats: OverviewStats
  initialRuns: ScraperRun[]
  brands: string[]
  initialProducts: ProductsResult
  pendingSubmissions: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) || 'overview'

  const setTab = useCallback((next: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  return (
    <ToastProvider>
      <style>{`@keyframes fdShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes fdPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <PageHeader title="Food Database" subtitle="Control centre for the Australian scraped food database" />

      <div className="flex mb-6" style={{ borderBottom: `1px solid ${C.dim}`, flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="cursor-pointer"
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 600, background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === key ? C.green : 'transparent'}`,
              color: tab === key ? C.text : C.muted, marginBottom: -1,
            }}
          >
            {label}
            {key === 'submissions' && pendingSubmissions > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#fff', background: C.amber, borderRadius: 999, padding: '1px 7px' }}>
                {pendingSubmissions}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab initialStats={initialStats} initialRuns={initialRuns} />}
      {tab === 'products' && <ProductsTab brands={brands} initialProducts={initialProducts} />}
      {tab === 'submissions' && <SubmissionsTab />}
      {tab === 'quality' && <QualityTab />}
      {tab === 'enrichment' && <EnrichmentTab />}
      {tab === 'settings' && <SettingsTab />}
    </ToastProvider>
  )
}
