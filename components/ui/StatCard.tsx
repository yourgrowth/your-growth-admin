type StatCardProps = {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export default function StatCard({ label, value, sub, color = '#e6edf3' }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-1"
      style={{ background: '#0d1117', border: '1px solid #1a2332' }}
    >
      <p className="text-xs uppercase tracking-wider" style={{ color: '#7d8fa3' }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: '#7d8fa3' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
