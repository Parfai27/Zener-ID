import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Copy, Download, XCircle } from 'lucide-react'
import { downloadReport, downloadStaffReport, getStaffVerification, getVerification } from '../../api'
import type { Verification } from '../../api/types'
import { Avatar, Banner, Button, CodeChip, Crumb, ErrorState, Loading, PageHead, Spinner, StatusPill, copyText, useData, useToast } from '../../components/ui'
import { ClaimedCard, EvidenceCard, ExtractedCard, ReviewHistory, SessionCard } from '../../components/SessionCard'
import { dateTime, docLabel, fullName, reasonText } from '../../lib/format'

/** One verification. The client dashboard opens it by reference, the admin console by id. */
export function VerificationDetail({ scope = 'client' }: { scope?: 'client' | 'staff' }) {
  const { reference = '', id = '' } = useParams()
  const key = scope === 'client' ? reference : id
  const { data: v, error, loading, reload } = useData(() => (scope === 'client' ? getVerification(key) : getStaffVerification(key)), [key, scope])
  const back = scope === 'client' ? '/app/verifications' : '/admin/verifications'
  // While the applicant is still at it, look again every few seconds so the
  // result appears by itself.
  const open = v?.status === 'pending' || v?.status === 'in_progress'
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(reload, 5000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <>
      <Crumb to={back}>Verifications</Crumb>
      {loading && !v && <Loading />}
      {error && !v && <ErrorState message={error} onRetry={reload} />}
      {v && <Detail v={v} scope={scope} />}
    </>
  )
}

function Detail({ v, scope }: { v: Verification; scope: 'client' | 'staff' }) {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)
  const report = async () => {
    setDownloading(true)
    try { await (scope === 'client' ? downloadReport(v.reference) : downloadStaffReport(v.id, v.reference)) } catch (e) { toast((e as Error).message, 'bad') } finally { setDownloading(false) }
  }
  return (
    <>
      <PageHead center
        title={<span className="flex flex-wrap items-center gap-2.5"><Avatar name={fullName(v.applicant)} lg /><span className="text-2xl">{fullName(v.applicant)}</span><StatusPill status={v.status} /></span>}
        sub={
          <span className="text-[12.5px]">
            <span className="font-mono">{v.reference}</span>
            {v.document_type && <> · {docLabel[v.document_type]}</>}
            {v.customer_id && <> · {v.customer_id}</>}
            {v.completed_at ? <> · Completed {dateTime(v.completed_at)}{v.decision_seconds ? ` · ${v.decision_seconds} s` : ''}</> : <> · Created {dateTime(v.created_at)}</>}
            {scope === 'staff' && v.client_name && <> · {v.client_name}</>}
          </span>
        }>
        {open(v) && v.session_url && (
          <Button onClick={() => { copyText(v.session_url); toast('Applicant link copied') }}><Copy size={16} /> Copy link</Button>
        )}
        <Button onClick={report} disabled={downloading}>{downloading ? <Spinner sm /> : <Download size={16} />} Download report</Button>
      </PageHead>
      <DecisionBanner v={v} />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <SessionCard v={v} />
          <ReviewHistory v={v} />
        </div>
        <div className="flex flex-col gap-4">
          <EvidenceCard v={v} />
          <ExtractedCard v={v} />
          <ClaimedCard v={v} />
        </div>
      </div>
    </>
  )
}

const open = (v: Verification) => v.status === 'pending' || v.status === 'in_progress'

function DecisionBanner({ v }: { v: Verification }) {
  if (v.status === 'passed')
    return <Banner tone="ok" icon={<CheckCircle2 size={20} />} title="Verified">{v.reviews.length ? 'Approved after manual review.' : `All ${v.checks.length || ''} checks passed.`}</Banner>
  if (v.status === 'failed')
    return (
      <Banner tone="bad" icon={<XCircle size={20} />} title={`Declined: ${(reasonText[v.reasons[0]] || 'a check failed').toLowerCase()}`}
        action={<div className="flex flex-wrap gap-1.5">{v.reasons.map(r => <CodeChip key={r} tone="bad" className="!bg-white">{r}</CodeChip>)}</div>}>
        {v.checks.length ? `${v.checks.filter(c => c.status === 'fail').length} of ${v.checks.length} checks failed.` : ''}{v.reviews.length ? ' Decided by a reviewer.' : ''}
      </Banner>
    )
  if (v.status === 'needs_review')
    return <Banner tone="warn" icon={<AlertTriangle size={20} />} title="Waiting for a reviewer">{reasonText[v.reasons[0]] || 'A check needs a person to look at it'}. Zener ID staff usually decide within a few hours.</Banner>
  if (v.status === 'expired')
    return <Banner tone="info" icon={<Clock size={20} />} title="Link expired">The applicant did not finish before {dateTime(v.expires_at || undefined)}. Create a new verification to try again.</Banner>
  return <Banner tone="info" icon={<Clock size={20} />} title={v.status === 'pending' ? 'Waiting for the applicant' : 'Applicant is completing the checks'}>This page updates by itself when they finish.</Banner>
}
