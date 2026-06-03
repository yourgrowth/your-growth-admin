'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import GlobalSearch from './GlobalSearch'
import { signOut } from '@/app/actions/auth'

function ChartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M0 11h2v4H0v-4zm4-4h2v8H4V7zm4-4h2v12H8V3zm4-3h2v15h-2V0z" />
    </svg>
  )
}

type NavItem = { label: string; href: string; icon?: React.ReactNode }

const nav: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Command Centre', href: '/dashboard' },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { label: 'Analytics', href: '/analytics' },
      { label: 'Onboarding', href: '/onboarding' },
    ],
  },
  {
    group: 'Users',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'Habits', href: '/habits' },
      { label: 'Goals', href: '/goals' },
      { label: 'Journal', href: '/journal' },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Growth Bible', href: '/content' },
      { label: 'The Gardener', href: '/gardener' },
      { label: 'Nutrition', href: '/nutrition' },
    ],
  },
  {
    group: 'Business',
    items: [
      { label: 'Subscriptions', href: '/subscriptions' },
      { label: 'Notifications', href: '/notifications' },
      { label: 'Growth Intelligence', href: '/dashboard/growth', icon: <ChartIcon /> },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Activity', href: '/activity' },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Settings', href: '/settings' },
      { label: 'Security', href: '/settings/security' },
      { label: 'Health', href: '/health' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-y-auto"
      style={{ width: 224, background: '#0d1117', borderRight: '1px solid #1a2332' }}
    >
      <div
        className="flex flex-col gap-0.5 px-4 py-5"
        style={{ borderBottom: '1px solid #1a2332' }}
      >
        <span className="text-sm font-bold" style={{ color: '#3fb950' }}>
          YOUR GROWTH
        </span>
        <span className="text-xs" style={{ color: '#7d8fa3' }}>
          ADMIN PANEL
        </span>
      </div>

      <GlobalSearch />

      <nav className="flex flex-col gap-6 px-3 py-4 flex-1">
        {nav.map(({ group, items }) => (
          <div key={group}>
            <p
              className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: '#7d8fa3' }}
            >
              {group}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map(({ label, href, icon }) => {
                const active = pathname === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors"
                      style={{
                        color: active ? '#3fb950' : '#e6edf3',
                        background: active ? 'rgba(63,185,80,0.1)' : 'transparent',
                      }}
                    >
                      {icon}
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4" style={{ borderTop: '1px solid #1a2332' }}>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors"
            style={{ color: '#7d8fa3' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#e6edf3'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#7d8fa3'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M10 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6v-1.5H4.5v-11H10V1zm2.854 4.646-1.5 1.5L12.207 8H6v1.5h6.207l-.853.854 1.06 1.06L14.914 8.5a.75.75 0 0 0 0-1.06l-2-2z" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
