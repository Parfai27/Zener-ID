import { BadgeCheck } from 'lucide-react'
import type { Metadata } from 'next'

import { Filters } from '@/components/filters'
import { Pagination } from '@/components/pagination'
import { EmptyState, PageHeader } from '@/components/ui'
import { VerificationTable } from '@/components/verification-table'
import { api } from '@/lib/api'
import type { VerificationList } from '@/lib/types'

export const metadata: Metadata = { title: 'Verified users' }

const PAGE_SIZE = 20

type Search = { q?: string; from?: string; to?: string; page?: string }

export default async function VerifiedUsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const list = await api<VerificationList>('/v1/verifications', {
    status: 'passed',
    q: sp.q,
    created_from: sp.from,
    created_to: sp.to,
    page,
    page_size: PAGE_SIZE,
  })
  const filtered = Boolean(sp.q || sp.from || sp.to)

  return (
    <>
      <PageHeader
        title="Verified users"
        description={`Customers who completed verification successfully${list.total ? ` · ${list.total} in total` : ''}.`}
      />
      <div className="card">
        <div className="border-b border-line p-4">
          <Filters placeholder="Search verified customers by name, email or reference" />
          <p className="mt-2 text-xs text-ink-4">Dates filter by when the verification was created.</p>
        </div>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<BadgeCheck className="size-5" />}
            title={filtered ? 'Nothing matches' : 'No verified users yet'}
            body={
              filtered
                ? 'No verified customer matches this search or date range.'
                : 'Customers appear here once their identity has been confirmed.'
            }
            action={filtered ? undefined : { href: '/dashboard/verifications/new', label: 'Create a verification' }}
          />
        ) : (
          <>
            <VerificationTable items={list.items} mode="verified" />
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} basePath="/dashboard/verified" params={sp} />
          </>
        )}
      </div>
    </>
  )
}
