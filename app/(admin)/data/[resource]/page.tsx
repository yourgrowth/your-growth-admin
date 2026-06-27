import { notFound } from 'next/navigation'
import { getResourceConfig } from '@/lib/admin/resources'
import { listResource } from '@/app/actions/resources'
import DataResourceClient from './DataResourceClient'

export default async function DataResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const config = getResourceConfig(resource)
  if (!config) notFound()

  const initial = await listResource(config.table, {
    page: 1,
    pageSize: 50,
    sortKey: config.defaultSort.key,
    sortDir: config.defaultSort.dir,
  })

  return <DataResourceClient config={config} initial={initial} />
}
