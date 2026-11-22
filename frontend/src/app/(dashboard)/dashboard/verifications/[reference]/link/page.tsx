import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { LinkShare } from '@/components/link-share'
import { PageHeader, StatusBadge } from '@/components/ui'
import { dateTime } from '@/lib/format'
import { getVerification } from '@/lib/verifications'

export const metadata: Metadata = { title: 'Verification link' }

export default async function LinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { reference } = await params
  const { created } = await searchParams
  const v = await getVerification(reference)
  const name = [v.claimed.first_name, v.claimed.last_name].filter(Boolean).join(' ') || v.applicant.name || 'your customer'
  const open = v.status === 'pending' || v.status === 'in_progress'

  return (
    <>
      <Link
        href={`/dashboard/verifications/${encodeURIComponent(v.reference)}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Verification details
      </Link>
      <PageHeader title="Verification link" description={`Send this link to ${name} to verify their identity.`} />

      {created && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-ok-tint px-5 py-4 text-sm text-ok">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>
            Verification <span className="font-mono font-semibold">{v.reference}</span> created. Share the link or QR
            code below.
          </span>
        </div>
      )}

      {!open && (
        <div className="mb-6 rounded-xl bg-warn-tint px-5 py-4 text-sm text-warn">
          This verification is no longer open, so the link will not start a new attempt. Current status:{' '}
          <StatusBadge status={v.status} />
        </div>
      )}

      <LinkShare
        url={v.session_url}
        customerName={name}
        email={v.claimed.email ?? v.applicant.email ?? undefined}
        phone={v.claimed.phone}
        reference={v.reference}
        expiresAt={dateTime(v.expires_at)}
      />
    </>
  )
}
