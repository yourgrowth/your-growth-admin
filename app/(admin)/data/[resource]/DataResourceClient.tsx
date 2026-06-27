'use client'

import Link from 'next/link'
import { ToastProvider, C, Pill } from '@/components/admin/kit'
import ResourceManager from '@/components/admin/ResourceManager'
import type { ResourceConfig } from '@/lib/admin/resources'
import type { ListResult } from '@/app/actions/resources'

export default function DataResourceClient({ config, initial }: { config: ResourceConfig; initial: ListResult }) {
  return (
    <ToastProvider>
      <div style={{ marginBottom: 18 }}>
        <Link href="/data" style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>← Data Control</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{config.label}</h1>
          <Pill color={C.muted2}>{config.group}</Pill>
          <Pill color={C.muted2}>table: {config.table}</Pill>
          {!config.creatable && <Pill color={C.amber}>create disabled</Pill>}
          {!config.deletable && <Pill color={C.amber}>delete disabled</Pill>}
        </div>
        {config.description && <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{config.description}</p>}
      </div>
      <ResourceManager config={config} initial={initial} />
    </ToastProvider>
  )
}
