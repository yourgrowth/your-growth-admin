'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ResultItem = {
  id: string
  label: string
  sub: string
  href: string
  group: string
}

const GROUP_ORDER = ['Users', 'Content', 'Gardener', 'Nutrition']

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      setLoading(true)
      const pattern = `%${q}%`

      const [{ data: profiles }, { data: videos }, { data: summaries }, { data: meals }] =
        await Promise.all([
          supabase.from('profiles').select('id, full_name, email').ilike('full_name', pattern).limit(5),
          supabase.from('growth_bible_videos').select('id, title').ilike('title', pattern).limit(5),
          supabase.from('gardener_summaries').select('id, summary, phase').ilike('summary', pattern).limit(5),
          supabase.from('meal_suggestions').select('id, suggestion, created_at').ilike('suggestion', pattern).limit(5),
        ])

      const items: ResultItem[] = [
        ...(profiles ?? []).map((p) => ({
          id: `user-${p.id}`,
          label: p.full_name ?? 'Unknown',
          sub: p.email ?? '',
          href: '/users',
          group: 'Users',
        })),
        ...(videos ?? []).map((v) => ({
          id: `video-${v.id}`,
          label: v.title,
          sub: '',
          href: '/content',
          group: 'Content',
        })),
        ...(summaries ?? []).map((s) => ({
          id: `gardener-${s.id}`,
          label: (s.summary ?? '').slice(0, 60) + ((s.summary?.length ?? 0) > 60 ? '…' : ''),
          sub: s.phase ?? '',
          href: '/gardener',
          group: 'Gardener',
        })),
        ...(meals ?? []).map((m) => ({
          id: `meal-${m.id}`,
          label: (m.suggestion ?? '').slice(0, 60) + ((m.suggestion?.length ?? 0) > 60 ? '…' : ''),
          sub: m.created_at ? new Date(m.created_at).toLocaleDateString() : '',
          href: '/nutrition',
          group: 'Nutrition',
        })),
      ]

      setResults(items)
      setOpen(items.length > 0)
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const grouped = GROUP_ORDER.reduce<Record<string, ResultItem[]>>((acc, g) => {
    const items = results.filter((r) => r.group === g)
    if (items.length > 0) acc[g] = items
    return acc
  }, {})

  const handleSelect = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={containerRef} className="relative px-3 py-3" style={{ borderBottom: '1px solid #1a2332' }}>
      <div
        className="flex items-center gap-2 rounded px-2.5 py-1.5"
        style={{ background: '#080b0f', border: '1px solid #1a2332' }}
      >
        <span className="text-xs shrink-0" style={{ color: '#7d8fa3' }}>⌕</span>
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          className="flex-1 bg-transparent text-xs outline-none min-w-0"
          style={{ color: '#e6edf3' }}
        />
        {loading && <span className="text-xs shrink-0" style={{ color: '#7d8fa3' }}>…</span>}
      </div>

      {open && (
        <div
          className="absolute left-3 right-3 top-full mt-1 rounded-lg overflow-hidden z-50"
          style={{ background: '#0d1117', border: '1px solid #1a2332', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
        >
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#7d8fa3', background: '#080b0f', borderBottom: '1px solid #1a2332' }}
              >
                {group}
              </p>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.href)}
                  className="w-full text-left px-3 py-2 flex flex-col gap-0.5 cursor-pointer"
                  style={{ borderBottom: '1px solid #1a2332' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a2332' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span className="text-xs truncate" style={{ color: '#e6edf3' }}>{item.label}</span>
                  {item.sub && (
                    <span className="text-xs truncate" style={{ color: '#7d8fa3' }}>{item.sub}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
