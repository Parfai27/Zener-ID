import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Download,
  FileText,
  Link2,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge, Field, PageHeader } from '@/components/ui'
import { countryName } from '@/lib/countries'
import {
  checkLabel,
  dateOnly,
  dateTime,
  documentLabel,
  decodeParam,
  humanize,
  reason,
  statusInfo,
  stepLabel,
  type Tone,
} from '@/lib/format'
import type { DetailStep, EvidenceFile, VerificationDetail } from '@/lib/types'
import { getVerification } from '@/lib/verifications'

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  const { reference } = await params
  return { title: `Verification ${decodeParam(reference)}` }
}

export default async function VerificationDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  const v = await getVerification(reference)
  const ref = encodeURIComponent(v.reference)
  const claimedName = [v.claimed.first_name, v.claimed.last_name].filter(Boolean).join(' ')
  const name = claimedName || v.applicant.name || 'Unnamed customer'
  const open = v.status === 'pending' || v.status === 'in_progress'
  const info = statusInfo[v.status]

  return (
    <>
      <Link href="/dashboard/verifications" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> All verifications
      </Link>
      <PageHeader
        title={name}
        description={`Reference ${v.reference}`}
        action={
          <div className="flex flex-wrap gap-2">
            {open && (
              <Link href={`/dashboard/verifications/${ref}/link`} className="btn-secondary">
                <Link2 className="size-4" /> Link & QR code
              </Link>
            )}
            <a href={`/api/zid/verifications/${ref}/report`} className="btn-primary">
              <Download className="size-4" /> Download report (PDF)
            </a>
          </div>
        }
      />

      <Outcome tone={info.tone} label={info.label} hint={info.hint} reasons={v.reasons} warnings={v.warnings} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink">Customer</h2>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Details you entered</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <Field label="First name">{v.claimed.first_name}</Field>
                  <Field label="Last name">{v.claimed.last_name}</Field>
                  <Field label="Date of birth">{v.claimed.date_of_birth && dateOnly(v.claimed.date_of_birth)}</Field>
                  <Field label="Country">{v.claimed.country && countryName(v.claimed.country)}</Field>
                  <Field label="Email">{v.claimed.email ?? v.applicant.email}</Field>
                  <Field label="Phone">{v.claimed.phone}</Field>
                </dl>
              </div>
              <div className="md:border-l md:border-line md:pl-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Read from the document</h3>
                {v.document ? (
                  <dl className="grid grid-cols-2 gap-4">
                    <Field label="Full name">{v.document.full_name}</Field>
                    <Field label="Date of birth">{v.document.date_of_birth && dateOnly(v.document.date_of_birth)}</Field>
                    <Field label="Document">{documentLabel[v.document.document_type] ?? humanize(v.document.document_type)}</Field>
                    <Field label="Number">{v.document.document_number_last4 && `•••• ${v.document.document_number_last4}`}</Field>
                    <Field label="Issued by">{v.document.issuing_country && countryName(v.document.issuing_country)}</Field>
                    <Field label="Nationality">{v.document.nationality && countryName(v.document.nationality)}</Field>
                    <Field label="Expires">{v.document.expiry_date && dateOnly(v.document.expiry_date)}</Field>
                    <Field label="Decision">{humanize(v.document.decision)}</Field>
                  </dl>
                ) : (
                  <p className="text-sm text-ink-3">The customer has not submitted a document yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold text-ink">Verification results</h2>
            <div className="mt-4 divide-y divide-line">
              {orderedSteps(v).map((step) => (
                <StepResult key={step.step} step={step} />
              ))}
            </div>
          </section>

          {v.aml && <AmlResult aml={v.aml} />}

          <Evidence reference={ref} files={v.evidence} />
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="text-base font-bold text-ink">Timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-4 text-sm">
              <TimelineItem label="Link created" at={v.created_at} done />
              <TimelineItem label="Customer started" at={v.started_at} done={Boolean(v.started_at)} />
              <TimelineItem
                label={v.completed_at ? `Decision: ${info.label}` : 'Decision'}
                at={v.completed_at}
                done={Boolean(v.completed_at)}
              />
              {v.status !== 'passed' && v.status !== 'failed' && (
                <TimelineItem label={v.status === 'expired' ? 'Link expired' : 'Link expires'} at={v.expires_at} done={v.status === 'expired'} />
              )}
            </ol>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-bold text-ink">Request</h2>
            <dl className="mt-4 space-y-4">
              <Field label="Reference">
                <span className="font-mono text-xs">{v.reference}</span>
              </Field>
              <Field label="Checks requested">{v.services.map((s) => stepLabel[s] ?? humanize(s)).join(', ')}</Field>
              <Field label="Document chosen">{v.document_type && (documentLabel[v.document_type] ?? humanize(v.document_type))}</Field>
            </dl>
          </section>

          {v.reviews.length > 0 && (
            <section className="card p-6">
              <h2 className="text-base font-bold text-ink">Manual review</h2>
              <ul className="mt-4 space-y-4 text-sm">
                {v.reviews.map((r, i) => (
                  <li key={i}>
                    <p className="font-semibold text-ink">
                      {humanize(r.action)} <span className="font-normal text-ink-3">by {r.by}</span>
                    </p>
                    <p className="text-xs text-ink-3">{dateTime(r.at)}</p>
                    {r.note && <p className="mt-1 text-ink-2">{r.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}

function Outcome({
  tone,
  label,
  hint,
  reasons,
  warnings,
}: {
  tone: Tone
  label: string
  hint: string
  reasons: string[]
  warnings: string[]
}) {
  const style: Record<Tone, string> = {
    ok: 'bg-ok-tint text-ok',
    bad: 'bg-bad-tint text-bad',
    warn: 'bg-warn-tint text-warn',
    info: 'bg-info-tint text-info',
    muted: 'bg-muted-tint text-muted',
  }
  const Icon = tone === 'ok' ? ShieldCheck : tone === 'bad' ? XCircle : tone === 'warn' ? AlertTriangle : CircleDashed
  return (
    <div className={`rounded-2xl px-6 py-5 ${style[tone]}`}>
      <div className="flex items-center gap-3">
        <Icon className="size-6" />
        <div>
          <p className="font-display text-lg font-extrabold">{label}</p>
          <p className="text-sm opacity-90">{hint}</p>
        </div>
      </div>
      {(reasons.length > 0 || warnings.length > 0) && (
        <ul className="mt-3 list-disc space-y-1 pl-12 text-sm">
          {reasons.map((r) => (
            <li key={r}>{reason(r)}</li>
          ))}
          {warnings.map((w) => (
            <li key={w} className="opacity-80">
              Warning: {reason(w)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Every step that was asked for, in the order asked, including ones not reached yet. */
function orderedSteps(v: VerificationDetail): DetailStep[] {
  const byName = new Map(v.steps.map((s) => [s.step, s]))
  const asked = v.services.map(
    (name) =>
      byName.get(name) ?? {
        step: name,
        attempt: 0,
        status: 'pending',
        reasons: [],
        warnings: [],
        extracted: {},
        checks: [],
        match_score: null,
        match_threshold: null,
        started_at: null,
        completed_at: null,
      },
  )
  const extra = v.steps.filter((s) => !v.services.includes(s.step))
  return [...asked, ...extra]
}

function resultTone(status: string): { tone: Tone; word: string } {
  switch (status) {
    case 'pass':
      return { tone: 'ok', word: 'Passed' }
    case 'fail':
      return { tone: 'bad', word: 'Failed' }
    case 'review':
      return { tone: 'warn', word: 'Review' }
    case 'skipped':
      return { tone: 'muted', word: 'Skipped' }
    default:
      return { tone: 'muted', word: 'Not done yet' }
  }
}

function StepResult({ step }: { step: DetailStep }) {
  const r = resultTone(step.status)
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{stepLabel[step.step] ?? humanize(step.step)}</p>
          {step.attempt > 1 && <p className="text-xs text-ink-3">Attempt {step.attempt}</p>}
        </div>
        <Badge tone={r.tone}>{r.word}</Badge>
      </div>
      {step.match_score !== null && (
        <p className="mt-2 text-sm text-ink-2">
          Face match score <span className="font-semibold">{Math.round(step.match_score * 100)}%</span>
          {step.match_threshold !== null && (
            <span className="text-ink-3"> (needs {Math.round(step.match_threshold * 100)}%)</span>
          )}
        </p>
      )}
      {step.checks.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {step.checks.map((c) => {
            const t = resultTone(c.status)
            const Icon = t.tone === 'ok' ? CheckCircle2 : t.tone === 'bad' ? XCircle : t.tone === 'warn' ? AlertTriangle : CircleDashed
            const color = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', info: 'text-info', muted: 'text-ink-4' }[t.tone]
            return (
              <li key={c.name} className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
                <span>
                  <span className="font-medium text-ink">{checkLabel[c.name] ?? humanize(c.name)}</span>
                  {c.reasons.length > 0 && <span className="block text-xs text-ink-3">{c.reasons.map(reason).join('; ')}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {step.checks.length === 0 && step.reasons.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
          {step.reasons.map((x) => (
            <li key={x}>{reason(x)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AmlResult({ aml }: { aml: Record<string, unknown> }) {
  const outcome = String(aml.outcome ?? 'unknown')
  const matches = Array.isArray(aml.matches) ? aml.matches.length : 0
  // The outcomes backend/app/screening/yente.py gives.
  const shown: Record<string, { tone: Tone; word: string }> = {
    no_match: { tone: 'ok', word: 'No match' },
    possible_match: { tone: 'warn', word: 'Possible match' },
    strong_match: { tone: 'bad', word: 'Strong match' },
    unavailable: { tone: 'muted', word: 'Not available' },
  }
  const { tone, word } = shown[outcome] ?? { tone: 'muted' as Tone, word: humanize(outcome) }
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">AML screening</h2>
        <Badge tone={tone}>{word}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Possible matches">{String(matches)}</Field>
        <Field label="Lists checked">{aml.dataset ? humanize(String(aml.dataset)) : null}</Field>
        <Field label="Screened">{typeof aml.screened_at === 'string' ? dateTime(aml.screened_at) : null}</Field>
      </dl>
    </section>
  )
}

function Evidence({ reference, files }: { reference: string; files: EvidenceFile[] }) {
  const shown = files.filter((f) => f.content_type.startsWith('image/') || f.content_type.startsWith('video/'))
  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold text-ink">Captured images</h2>
      {shown.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-3">
          <FileText className="size-4" /> Nothing captured yet.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {shown.map((f) => {
            const src = `/api/zid/verifications/${reference}/evidence/${f.id}`
            const video = f.content_type.startsWith('video/')
            return (
              <a key={f.id} href={src} target="_blank" rel="noreferrer" className="group block">
                <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line bg-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={video ? `${src}/thumbnail` : src}
                    alt={humanize(f.kind)}
                    loading="lazy"
                    className="size-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <p className="mt-1.5 text-xs font-medium text-ink-2">
                  {humanize(f.kind)}
                  {video && ' (video)'}
                  {f.attempt && f.attempt > 1 ? ` · attempt ${f.attempt}` : ''}
                </p>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}

function TimelineItem({ label, at, done }: { label: string; at: string | null; done: boolean }) {
  return (
    <li className="relative">
      <span className={`absolute top-1 -left-[21px] size-2.5 rounded-full ring-4 ring-white ${done ? 'bg-evergreen' : 'bg-line-strong'}`} />
      <p className={`font-medium ${done ? 'text-ink' : 'text-ink-3'}`}>{label}</p>
      <p className="text-xs text-ink-3">{at ? dateTime(at) : 'Not yet'}</p>
    </li>
  )
}
