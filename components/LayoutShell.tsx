'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 30,
          }}
        />
      )}

      {/* Sidebar wrapper */}
      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        top: 0, left: 0, bottom: 0,
        zIndex: 40,
        transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.22s ease',
        willChange: 'transform',
      }}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        <Topbar onMenuToggle={() => setSidebarOpen(prev => !prev)} isMobile={isMobile} />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '16px 14px' : '32px',
            background: '#070a0e',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
