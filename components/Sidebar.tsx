'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/app/actions/auth'
import AdminIcon from './AdminIcon'

const C = {
  bg: '#070a0e', surface: '#0d1117', dim: '#1a2332', dim2: '#243044',
  text: '#e6edf3', muted: '#7d8fa3', muted2: '#5a6b7d', green: '#3fb950',
}

type NavItem = { label: string; href: string; icon: string }

const nav: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Command Centre', href: '/dashboard', icon: 'grid' },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { label: 'Analytics', href: '/analytics', icon: 'trend' },
      { label: 'Onboarding', href: '/onboarding', icon: 'funnel' },
      { label: 'Growth Intelligence', href: '/dashboard/growth', icon: 'chart' },
    ],
  },
  {
    group: 'Users',
    items: [
      { label: 'Users', href: '/users', icon: 'users' },
      { label: 'Habits', href: '/habits', icon: 'check' },
      { label: 'Goals', href: '/goals', icon: 'target' },
      { label: 'Journal', href: '/journal', icon: 'book' },
      { label: 'Bonsai', href: '/bonsai', icon: 'tree' },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Growth Bible', href: '/content', icon: 'play' },
      { label: 'The Gardener', href: '/gardener', icon: 'leaf' },
      { label: 'AI Usage', href: '/ai-usage', icon: 'cpu' },
      { label: 'Nutrition', href: '/nutrition', icon: 'card' },
      { label: 'Food Database', href: '/food-database', icon: 'database' },
    ],
  },
  {
    group: 'Data & Intelligence',
    items: [
      { label: 'Mastering Yourself', href: '/mastery', icon: 'leaf' },
      { label: 'Data Control', href: '/data', icon: 'database' },
      { label: 'Intelligence Models', href: '/data/user_models', icon: 'cpu' },
    ],
  },
  {
    group: 'Business',
    items: [
      { label: 'Subscriptions', href: '/subscriptions', icon: 'card' },
      { label: 'Notifications', href: '/notifications', icon: 'bell' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Activity', href: '/activity', icon: 'pulse' },
      { label: 'Support', href: '/support', icon: 'chat' },
      { label: 'Safety', href: '/safety', icon: 'shield' },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: 'gear' },
      { label: 'Security', href: '/settings/security', icon: 'shield' },
      { label: 'Feature Flags', href: '/feature-flags', icon: 'flag' },
      { label: 'Health', href: '/health', icon: 'life' },
    ],
  },
]

function NavLink({ item, onClose }: { item: NavItem; onClose?: () => void }) {
  const pathname = usePathname()
  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
  return (
    <Link
      href={item.href}
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 9px',
        borderRadius: 7,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: active ? C.green : C.muted,
        background: active ? 'rgba(63,185,80,0.1)' : 'transparent',
        position: 'relative',
        textDecoration: 'none',
        transition: 'color 0.12s, background 0.12s',
      }}
    >
      {active && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: 7,
          bottom: 7,
          width: 2.5,
          borderRadius: 2,
          background: C.green,
        }} />
      )}
      <AdminIcon name={item.icon} size={14} />
      {item.label}
    </Link>
  )
}

function AdminFooter() {
  const [name, setName] = useState('Admin')
  const [initial, setInitial] = useState('A')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      // display_name is a real profiles column omitted from the base type
      // (see ProfileExtended); cast the result to read it.
      ;(supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single() as unknown as Promise<{ data: { display_name: string | null } | null }>)
        .then(({ data }) => {
          const n = data?.display_name ?? user.email?.split('@')[0] ?? 'Admin'
          setName(n)
          setInitial(n.charAt(0).toUpperCase())
        })
    })
  }, [])

  return (
    <div style={{ padding: 12, borderTop: `1px solid ${C.dim}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#3fb950,#1f6f33)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'white',
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 10.5, color: C.muted }}>Founder · Admin</div>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          title="Sign out"
          style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <AdminIcon name="logout" size={14} />
        </button>
      </form>
    </div>
  )
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside
      style={{
        width: 230,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        background: C.surface,
        borderRight: `1px solid ${C.dim}`,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '16px 14px 14px', borderBottom: `1px solid ${C.dim}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#3fb950,#1f6f33)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22v-7M8 15a4 4 0 0 1-1-7.9A5 5 0 0 1 17 6a4 4 0 0 1-1 9z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: '0.02em' }}>YOUR GROWTH</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.13em' }}>ADMIN PANEL</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {nav.map(({ group, items }) => (
          <div key={group} style={{ marginBottom: 14 }}>
            <p style={{
              fontSize: 9.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: C.muted2,
              padding: '0 9px',
              marginBottom: 4,
            }}>
              {group}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} onClose={onClose} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <AdminFooter />
    </aside>
  )
}
