import { BadgeCheck, Clock, FileSearch, ListChecks, Plus, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { api } from '@/lib/api'
import { dateTime, initials, statusInfo, timeAgo } from '@/lib/format'
import type { VerificationList } from '@/lib/types'

export const metadata: Metadata = { title: 'Overview' }

export default async function OverviewPage() {
  // One request: the newest verifications, and a count for every status across
  // all of this company's verifications.
  const list = await api<VerificationList>('/v1/verifications', { page_size: 8 })
  const c = list.status_counts
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  const pending = c.pending + c.in_progress + c.needs_review

  const stats = [
    {
      label: 'Total verifications',
      value: total,
      note: 'Every request you have created',
      icon: ListChecks,
      tint: 'bg-mint-tint text-evergreen',
      href: '/dashboard/verifications',
    },
    {
      label: 'Verified users',
      value: c.passed,
      note: total ? `${Math.round((c.passed / total) * 100)}% of all requests` : 'Identity confirmed',
      icon: BadgeCheck,
      tint: 'bg-ok-tint text-ok',
      href: '/dashboard/verified',
    },
    {
      label: 'Pending',
      value: pending,
      note: `${c.pending} not opened · ${c.in_progress} in progress · ${c.needs_review} in review`,
      icon: Clock,
      tint: 'bg-warn-tint text-warn',
      href: '/dashboard/verifications?status=pending',
    },
    {
      label: 'Failed or rejected',
      value: c.failed,
      note: c.expired ? `${c.expired} more expired unfinished` : 'Checks did not pass',
      icon: XCircle,
      tint: 'bg-bad-tint text-bad',
      href: '/dashboard/verifications?status=failed',
    },
  ]

  return (
    <>
      <PageHeader
        title="Overview"
        description="How your customer verifications are going."
        action={
          <Link href="/dashboard/verifications/new" className="btn-primary">
            <Plus className="size-4" /> New verification
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, tint, href }) => (
          <Link key={label} href={href} className="card p-5 transition hover:border-line-strong">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-3">{label}</p>
              <span className={`grid size-9 place-items-center rounded-lg ${tint}`}>
                <Icon className="size-4.5" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold text-ink">{value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-3">{note}</p>
          </Link>
        ))}
      </div>

      <section className="card mt-8">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-ink">Recent activity</h2>
          {total > 0 && (
            <Link href="/dashboard/verifications" className="text-sm font-semibold text-evergreen hover:underline">
              View all
            </Link>
          )}
        </div>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="size-5" />}
            title="No verifications yet"
            body="Create your first verification request. You will get a link and QR code to send to your customer."
            action={{ href: '/dashboard/verifications/new', label: 'Create a verification' }}
          />
        ) : (
          <ul>
            {list.items.map((v) => (
              <li key={v.id} className="border-b border-line last:border-0">
                <Link
                  href={`/dashboard/verifications/${encodeURIComponent(v.reference)}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper/70"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-xs font-bold text-ink-2">
                    {initials(v.applicant.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {v.applicant.name || 'Unnamed customer'}
                    </span>
                    <span className="block truncate text-xs text-ink-3">
                      {activity(v.status)} · <span className="font-mono">{v.reference}</span>
                    </span>
                  </span>
                  <StatusBadge status={v.status} />
                  <span className="hidden w-24 text-right text-xs text-ink-3 sm:block" title={dateTime(lastChange(v))}>
                    {timeAgo(lastChange(v))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function lastChange(v: { completed_at: string | null; created_at: string }) {
  return v.completed_at ?? v.created_at
}

function activity(status: keyof typeof statusInfo) {
  switch (status) {
    case 'pending':
      return 'Verification link created'
    case 'in_progress':
      return 'Customer started verifying'
    case 'needs_review':
      return 'Sent for manual review'
    case 'passed':
      return 'Identity verified'
    case 'failed':
      return 'Verification declined'
    case 'expired':
      return 'Link expired'
  }
}
