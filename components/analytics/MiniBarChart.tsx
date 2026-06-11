'use client'

export default function MiniBarChart({
  rows,
  valueKey,
  labelKey,
  color = '#3fb950',
  unit = '',
}: {
  rows: Record<string, unknown>[]
  valueKey: string
  labelKey: string
  color?: string
  unit?: string
}) {
  const vals = rows.map((r) => Number(r[valueKey] ?? 0))
  const max = Math.max(...vals, 1)
  return (
    <div className="flex items-end gap-1" style={{ height: 64 }}>
      {rows.map((r, i) => {
        const val = Number(r[valueKey] ?? 0)
        const pct = (val / max) * 100
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center"
            title={`${String(r[labelKey])}: ${val}${unit}`}
          >
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(pct, 4)}%`,
                background: color,
                minHeight: 2,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
