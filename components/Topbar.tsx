'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const C = {
  dim: '#1a2332', text: '#e6edf3', muted: '#7d8fa3', green: '#3fb950',
  surface: '#0d1117', dim2: '#243044',
}

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Command Centre', subtitle: 'Platform overview' },
  '/analytics': { title: 'Analytics', subtitle: 'DAU · WAU · MAU' },
  '/onboarding': { title: 'Onboarding', subtitle: 'Activation funnel' },
  '/dashboard/growth': { title: 'Growth Intelligence', subtitle: 'Revenue & retention' },
  '/users': { title: 'Users', subtitle: 'All members' },
  '/habits': { title: 'Habits', subtitle: 'Platform habit data' },
  '/goals': { title: 'Goals', subtitle: 'Goal progress & categories' },
  '/journal': { title: 'Journal', subtitle: 'Entries & mood trends' },
  '/bonsai': { title: 'Bonsai', subtitle: 'Tree stage distribution' },
  '/content': { title: 'Growth Bible', subtitle: 'Video content library' },
  '/gardener': { title: 'The Gardener', subtitle: 'AI usage & summaries' },
  '/ai-usage': { title: 'AI Usage', subtitle: 'Cost & token tracking' },
  '/nutrition': { title: 'Nutrition', subtitle: 'Food log aggregates' },
  '/subscriptions': { title: 'Subscriptions', subtitle: 'MRR & plan data' },
  '/notifications': { title: 'Notifications', subtitle: 'Push & email logs' },
  '/activity': { title: 'Activity', subtitle: 'Live event feed' },
  '/support': { title: 'Support', subtitle: 'Help requests' },
  '/safety': { title: 'Safety', subtitle: 'Moderation & flags' },
  '/settings': { title: 'Settings', subtitle: 'Admin configuration' },
  '/settings/security': { title: 'Security', subtitle: 'Auth & access' },
  '/feature-flags': { title: 'Feature Flags', subtitle: 'Remote configuration' },
  '/health': { title: 'System Health', subtitle: 'Latency & uptime' },
}

type TimeRange = '24h' | '7d' | '30d' | '90d'

type TopbarProps = {
  onMenuToggle?: () => void
  isMobile?: boolean
}

export default function Topbar({ onMenuToggle, isMobile }: TopbarProps) {
  const pathname = usePathname()
  const [range, setRange] = useState<TimeRange>('7d')
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  // Find best matching meta (supports /users/[id] etc.)
  const meta = PAGE_META[pathname] ??
    Object.entries(PAGE_META).find(([k]) => pathname.startsWith(k + '/') || pathname === k)?.[1] ??
    { title: 'Admin', subtitle: 'Your Growth' }

  const ranges: TimeRange[] = ['24h', '7d', '30d', '90d']

  return (
    <header style={{
      height: 60,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'rgba(13,17,23,0.85)',
      backdropFilter: 'blur(8px)',
      borderBottom: `1px solid ${C.dim}`,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 28,
      paddingRight: 20,
      gap: 16,
    }}>
      {/* Title */}
      {/* Hamburger — mobile only */}
      {isMobile && (
        <button
          onClick={onMenuToggle}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '6px 8px', marginLeft: -8, marginRight: 4,
            display: 'flex', flexDirection: 'column', gap: 4.5, alignItems: 'center',
          }}
          aria-label="Open menu"
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{ display: 'block', width: 18, height: 1.5, borderRadius: 2, background: C.muted }} />
          ))}
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: C.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.title}</div>
        {!isMobile && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{meta.subtitle}</div>}
      </div>

      {/* Time range segmented control — hidden on mobile */}
      {!isMobile && (
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8,
          padding: 3,
          gap: 2,
          border: `1px solid ${C.dim}`,
        }}>
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: range === r ? C.dim2 : 'transparent',
                color: range === r ? C.text : C.muted,
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Divider — hidden on mobile */}
      {!isMobile && <div style={{ width: 1, height: 20, background: C.dim }} />}

      {/* Live indicator + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: C.green, boxShadow: `0 0 6px ${C.green}`,
          animation: 'pulse-dot 2s infinite',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </span>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </header>
  )
}
