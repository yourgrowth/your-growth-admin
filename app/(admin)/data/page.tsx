import Link from 'next/link'
import { resourcesByGroup, RESOURCES } from '@/lib/admin/resources'
import { getResourceCounts } from '@/app/actions/resources'

const C = {
  surface: '#0d1117', dim: '#1a2332', dim2: '#243044',
  text: '#e6edf3', muted: '#7d8fa3', muted2: '#5a6b7d', green: '#3fb950', cyan: '#39d0d8',
}

export default async function DataHubPage() {
  const groups = resourcesByGroup()
  const counts = await getResourceCounts(Object.keys(RESOURCES))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text }}>Data Control</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 6, maxWidth: 720 }}>
          Direct full-control access to every bonsai data table not covered by a dedicated section.
          Each opens a searchable, sortable, editable grid with create / edit / delete, raw-JSON editing,
          per-user filtering and CSV export. Every write is recorded in the admin audit log.
        </p>
      </div>

      {groups.map(({ group, items }) => (
        <div key={group} style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted2, marginBottom: 12 }}>{group}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {items.map((r) => (
              <Link
                key={r.table}
                href={`/data/${r.table}`}
                style={{ display: 'block', background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 16, textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.cyan }}>{(counts[r.table] ?? 0).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5, minHeight: 34 }}>{r.description ?? r.table}</p>
                <span style={{ fontSize: 10.5, color: C.muted2, fontFamily: 'monospace' }}>{r.table}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
