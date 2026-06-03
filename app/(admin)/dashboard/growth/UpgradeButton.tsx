'use client'

type Props = { userId: string; username: string }

export default function UpgradeButton({ userId, username }: Props) {
  return (
    <button
      onClick={() => console.log('Send upgrade prompt', { userId, username })}
      className="text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors"
      style={{
        background: 'rgba(63,185,80,0.1)',
        color: '#3fb950',
        border: '1px solid rgba(63,185,80,0.3)',
      }}
    >
      Send Upgrade Prompt
    </button>
  )
}
