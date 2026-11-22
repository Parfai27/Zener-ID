'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

/** Search and date range, kept in the URL so a filtered list can be shared or reloaded. */
export function Filters({ placeholder = 'Search name, email or reference' }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('page')
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  }

  // Search as the person types, a moment after they stop.
  useEffect(() => {
    if (q === (params.get('q') ?? '')) return
    const t = setTimeout(() => update({ q: q.trim() }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const hasFilters = params.get('q') || params.get('from') || params.get('to')

  return (
    <div className={`flex flex-wrap items-end gap-3 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          maxLength={120}
          className="field pl-9"
        />
      </div>
      <label className="text-xs text-ink-3">
        From
        <input
          type="date"
          value={params.get('from') ?? ''}
          max={params.get('to') ?? undefined}
          onChange={(e) => update({ from: e.target.value })}
          className="field mt-1 py-2"
        />
      </label>
      <label className="text-xs text-ink-3">
        To
        <input
          type="date"
          value={params.get('to') ?? ''}
          min={params.get('from') ?? undefined}
          onChange={(e) => update({ to: e.target.value })}
          className="field mt-1 py-2"
        />
      </label>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setQ('')
            update({ q: '', from: '', to: '' })
          }}
          className="btn-secondary py-2"
        >
          <X className="size-4" /> Clear
        </button>
      )}
    </div>
  )
}
