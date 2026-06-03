type ProgressBarProps = {
  value: number
  color?: string
}

export default function ProgressBar({ value, color = '#3fb950' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className="w-full rounded-full h-2"
      style={{ background: '#1a2332' }}
    >
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  )
}
