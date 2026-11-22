import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { countryName } from '@/lib/countries'
import { dateTime, documentLabel, initials, timeAgo } from '@/lib/format'
import type { VerificationSummary } from '@/lib/types'

import { StatusBadge } from './ui'

export function VerificationTable({
  items,
  mode = 'all',
}: {
  items: VerificationSummary[]
  /** "verified" shows when each was verified instead of its status. */
  mode?: 'all' | 'verified'
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-4">
            <th className="px-5 py-3 font-medium">Customer</th>
            <th className="px-5 py-3 font-medium">Reference</th>
            <th className="px-5 py-3 font-medium">Country</th>
            <th className="px-5 py-3 font-medium">Document</th>
            <th className="px-5 py-3 font-medium">{mode === 'verified' ? 'Verified on' : 'Status'}</th>
            <th className="px-5 py-3 font-medium">Created</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id} className="group border-b border-line last:border-0 hover:bg-paper/70">
              <td className="px-5 py-3.5">
                <Link href={`/dashboard/verifications/${encodeURIComponent(v.reference)}`} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-xs font-bold text-ink-2">
                    {initials(v.applicant.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{v.applicant.name || 'Unnamed customer'}</span>
                    <span className="block truncate text-xs text-ink-3">{v.applicant.email || '—'}</span>
                  </span>
                </Link>
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{v.reference}</td>
              <td className="px-5 py-3.5 text-ink-2">{countryName(v.applicant.country)}</td>
              <td className="px-5 py-3.5 text-ink-2">{v.document_type ? documentLabel[v.document_type] ?? v.document_type : '—'}</td>
              <td className="px-5 py-3.5">
                {mode === 'verified' ? <span className="text-ink-2">{dateTime(v.completed_at)}</span> : <StatusBadge status={v.status} />}
              </td>
              <td className="px-5 py-3.5 text-ink-3" title={dateTime(v.created_at)}>
                {timeAgo(v.created_at)}
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link
                  href={`/dashboard/verifications/${encodeURIComponent(v.reference)}`}
                  aria-label={`Open ${v.reference}`}
                  className="inline-grid size-8 place-items-center rounded-lg text-ink-4 group-hover:bg-subtle group-hover:text-ink"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
