type BadgeProps = {
  children: React.ReactNode
  color?: string
}

export default function Badge({ children, color = '#7d8fa3' }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
    >
      {children}
    </span>
  )
}
