import Link from 'next/link'

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number
  pageSize: number
  total: number
  basePath: string
  params: Record<string, string | undefined>
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const href = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') q.set(k, v)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-3">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary px-3 py-1.5">Previous</Link>
        ) : (
          <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-40">Previous</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className="btn-secondary px-3 py-1.5">Next</Link>
        ) : (
          <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-40">Next</span>
        )}
      </div>
    </div>
  )
}
