import { FileSearch, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Filters } from '@/components/filters'
import { Pagination } from '@/components/pagination'
import { EmptyState, PageHeader } from '@/components/ui'
import { VerificationTable } from '@/components/verification-table'
import { api } from '@/lib/api'
import { statusInfo } from '@/lib/format'
import { STATUSES, type VerificationList, type VerificationStatus } from '@/lib/types'

export const metadata: Metadata = { title: 'All verifications' }

const PAGE_SIZE = 20

// The task's words for each tab: pending, processing, review, completed, failed.
const TAB_LABEL: Record<VerificationStatus, string> = {
  pending: 'Pending',
  in_progress: 'Processing',
  needs_review: 'In review',
  passed: 'Completed',
  failed: 'Failed',
  expired: 'Expired',
}

type Search = { status?: string; q?: string; from?: string; to?: string; page?: string }

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const status = STATUSES.includes(sp.status as VerificationStatus) ? (sp.status as VerificationStatus) : undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const list = await api<VerificationList>('/v1/verifications', {
    status,
    q: sp.q,
    created_from: sp.from,
    created_to: sp.to,
    page,
    page_size: PAGE_SIZE,
  })
  const all = Object.values(list.status_counts).reduce((a, b) => a + b, 0)
  const filtered = Boolean(sp.q || sp.from || sp.to)

  const tabHref = (s?: VerificationStatus) => {
    const q = new URLSearchParams()
    if (s) q.set('status', s)
    if (sp.q) q.set('q', sp.q)
    if (sp.from) q.set('from', sp.from)
    if (sp.to) q.set('to', sp.to)
    const str = q.toString()
    return str ? `/dashboard/verifications?${str}` : '/dashboard/verifications'
  }

  const tabs: { key?: VerificationStatus; label: string; count: number }[] = [
    { label: 'All', count: all },
    ...STATUSES.map((s) => ({ key: s, label: TAB_LABEL[s], count: list.status_counts[s] ?? 0 })),
  ]

  return (
    <>
      <PageHeader
        title="All verifications"
        description="Every verification request, whatever its status."
        action={
          <Link href="/dashboard/verifications/new" className="btn-primary">
            <Plus className="size-4" /> New verification
          </Link>
        }
      />

      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
          {tabs.map((t) => {
            const on = t.key === status
            return (
              <Link
                key={t.label}
                href={tabHref(t.key)}
                title={t.key ? statusInfo[t.key].hint : undefined}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 text-sm font-medium ${
                  on ? 'border-evergreen text-ink' : 'border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-mint-tint text-evergreen' : 'bg-subtle text-ink-3'}`}>
                  {t.count}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="border-b border-line p-4">
          <Filters />
        </div>

        {list.items.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="size-5" />}
            title={all === 0 && !filtered ? 'No verifications yet' : 'Nothing matches'}
            body={
              all === 0 && !filtered
                ? 'Verification requests you create will appear here with their status.'
                : 'No verification matches these filters. Try another status, search or date range.'
            }
            action={all === 0 && !filtered ? { href: '/dashboard/verifications/new', label: 'Create a verification' } : undefined}
          />
        ) : (
          <>
            <VerificationTable items={list.items} />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={list.total}
              basePath="/dashboard/verifications"
              params={{ status, q: sp.q, from: sp.from, to: sp.to }}
            />
          </>
        )}
      </div>
    </>
  )
}
