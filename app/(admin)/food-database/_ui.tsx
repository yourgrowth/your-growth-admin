'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export const C = {
  bg: '#080b0f', surface: '#0d1117', dim: '#1a2332', dim2: '#243044',
  text: '#e6edf3', muted: '#7d8fa3', muted2: '#5a6b7d',
  green: '#3fb950', blue: '#58a6ff', purple: '#bc8cff', amber: '#d29922',
  red: '#f85149', cyan: '#39d0d8',
}

export const SOURCE_COLORS: Record<string, string> = {
  woolworths: C.green,
  coles: C.red,
  open_food_facts: C.blue,
  openfoodfacts: C.blue,
  off: C.blue,
  ollama: C.purple,
  ollama_vision: C.purple,
  manual: C.amber,
  user_photo: C.cyan,
}

export function sourceColor(source: string | null): string {
  if (!source) return C.muted
  return SOURCE_COLORS[source.toLowerCase()] ?? C.muted2
}

export function sourceLabel(source: string | null): string {
  if (!source) return 'Unknown'
  const map: Record<string, string> = {
    woolworths: 'Woolworths', coles: 'Coles', open_food_facts: 'Open Food Facts',
    openfoodfacts: 'Open Food Facts', off: 'Open Food Facts',
    ollama: 'Ollama', ollama_vision: 'Ollama', manual: 'Manual', user_photo: 'User photo',
  }
  return map[source.toLowerCase()] ?? source
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.dim}`, borderRadius: 10, padding: 18, ...style }}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted }}>{children}</p>
      {action}
    </div>
  )
}

export function Pill({ children, color = C.muted, filled }: { children: React.ReactNode; color?: string; filled?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, color: filled ? '#080b0f' : color,
      background: filled ? color : `${color}22`, border: `1px solid ${color}44`, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function Button({
  children, onClick, variant = 'ghost', disabled, type = 'button', size = 'md', style,
}: {
  children: React.ReactNode; onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'; disabled?: boolean
  type?: 'button' | 'submit'; size?: 'sm' | 'md'; style?: React.CSSProperties
}) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: C.green, color: '#080b0f', border: `1px solid ${C.green}` },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.dim2}` },
    danger: { background: 'transparent', color: C.red, border: `1px solid ${C.red}` },
    subtle: { background: C.dim, color: C.text, border: `1px solid ${C.dim2}` },
  }
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        padding: size === 'sm' ? '5px 10px' : '8px 14px',
        borderRadius: 7, fontSize: size === 'sm' ? 12 : 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.12s', ...variants[variant], ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: C.bg, border: `1px solid ${C.dim2}`, borderRadius: 7,
        padding: '8px 11px', fontSize: 13, color: C.text, outline: 'none', width: '100%', ...props.style,
      }}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        background: C.bg, border: `1px solid ${C.dim2}`, borderRadius: 7,
        padding: '8px 11px', fontSize: 13, color: C.text, outline: 'none', cursor: 'pointer', ...props.style,
      }}
    />
  )
}

export function Modal({ open, onClose, title, children, width = 560 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.dim2}`, borderRadius: 12, width: '100%', maxWidth: width }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.dim}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// --- Toasts -----------------------------------------------------------------
type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' }
const ToastCtx = createContext<(message: string, kind?: Toast['kind']) => void>(() => {})

export function useToast() { return useContext(ToastCtx) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => {
          const color = t.kind === 'error' ? C.red : t.kind === 'info' ? C.blue : C.green
          return (
            <div key={t.id} style={{
              background: C.surface, border: `1px solid ${color}55`, borderLeft: `3px solid ${color}`,
              borderRadius: 8, padding: '11px 16px', fontSize: 13, color: C.text, minWidth: 240, maxWidth: 380,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: React.CSSProperties }) {
  return (
    <div style={{
      height, width, borderRadius: 6, background: `linear-gradient(90deg, ${C.dim} 25%, ${C.dim2} 50%, ${C.dim} 75%)`,
      backgroundSize: '200% 100%', animation: 'fdShimmer 1.3s infinite', ...style,
    }} />
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</p>
      {hint && <p style={{ fontSize: 12.5 }}>{hint}</p>}
    </div>
  )
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function coverColor(pct: number): string {
  if (pct >= 80) return C.green
  if (pct >= 50) return C.amber
  return C.red
}
