'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/** Shared admin design system — same tokens as the Food Database `_ui.tsx`. */
export const C = {
  bg: '#080b0f', surface: '#0d1117', dim: '#1a2332', dim2: '#243044',
  text: '#e6edf3', muted: '#7d8fa3', muted2: '#5a6b7d',
  green: '#3fb950', blue: '#58a6ff', purple: '#bc8cff', amber: '#d29922',
  red: '#f85149', cyan: '#39d0d8',
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
  children, onClick, variant = 'ghost', disabled, type = 'button', size = 'md', style, title,
}: {
  children: React.ReactNode; onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'; disabled?: boolean
  type?: 'button' | 'submit'; size?: 'sm' | 'md'; style?: React.CSSProperties; title?: string
}) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: C.green, color: '#080b0f', border: `1px solid ${C.green}` },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.dim2}` },
    danger: { background: 'transparent', color: C.red, border: `1px solid ${C.red}` },
    subtle: { background: C.dim, color: C.text, border: `1px solid ${C.dim2}` },
  }
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      style={{
        padding: size === 'sm' ? '5px 10px' : '8px 14px',
        borderRadius: 7, fontSize: size === 'sm' ? 12 : 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.12s', whiteSpace: 'nowrap', ...variants[variant], ...style,
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

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        background: C.bg, border: `1px solid ${C.dim2}`, borderRadius: 7, padding: '8px 11px',
        fontSize: 13, color: C.text, outline: 'none', width: '100%', resize: 'vertical',
        fontFamily: 'inherit', lineHeight: 1.5, ...props.style,
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
        padding: '8px 11px', fontSize: 13, color: C.text, outline: 'none', cursor: 'pointer', width: '100%', ...props.style,
      }}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.muted, marginBottom: 5 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 10.5, color: C.muted2, marginTop: 4 }}>{hint}</span>}
    </label>
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
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '50px 20px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.dim2}`, borderRadius: 12, width: '100%', maxWidth: width }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.dim}`, position: 'sticky', top: 0, background: C.surface, borderRadius: '12px 12px 0 0', zIndex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Delete', danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; body: string; confirmLabel?: string; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, marginBottom: 18 }}>{body}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 18, borderBottom: `1px solid ${C.dim}`, paddingBottom: 0 }}>
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 12px', fontSize: 12.5, fontWeight: on ? 700 : 500,
              color: on ? C.green : C.muted, borderBottom: `2px solid ${on ? C.green : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
          </button>
        )
      })}
    </div>
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
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Date.now() - t
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
      <style>{`@keyframes fdShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </ToastCtx.Provider>
  )
}
