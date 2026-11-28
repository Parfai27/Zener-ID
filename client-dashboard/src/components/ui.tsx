import Link from 'next/link'

import { statusInfo, type Tone } from '@/lib/format'
import type { VerificationStatus } from '@/lib/types'

const toneClass: Record<Tone, string> = {
  ok: 'bg-ok-tint text-ok',
  bad: 'bg-bad-tint text-bad',
  warn: 'bg-warn-tint text-warn',
  info: 'bg-info-tint text-info',
  muted: 'bg-muted-tint text-muted',
}

const dotClass: Record<Tone, string> = {
  ok: 'bg-ok',
  bad: 'bg-bad',
  warn: 'bg-warn',
  info: 'bg-info',
  muted: 'bg-muted',
}

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      <span className={`size-1.5 rounded-full ${dotClass[tone]}`} />
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const info = statusInfo[status] ?? { label: status, tone: 'muted' as Tone }
  return <Badge tone={info.tone}>{info.label}</Badge>
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-pine sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-mint-tint text-evergreen">{icon}</span>
      <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-6">
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="card border-bad/30 bg-bad-tint p-6 text-sm text-bad">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1">{message}</p>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-4">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words text-ink">{children || '—'}</dd>
    </div>
  )
}
