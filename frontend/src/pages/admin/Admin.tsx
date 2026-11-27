import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, ChevronRight, Copy, RefreshCw, X } from 'lucide-react'
import { adminOverview, adminVerifications, canManage, canReview, decide, getStaffVerification, listClients, reviewQueue, setClientStatus, type Decision } from '../../api'
import type { Client, Verification, VerificationStatus } from '../../api/types'
import {
  Avatar, Banner, Button, Card, CardHead, Chip, CodeChip, Crumb, EmptyRow, ErrorState, ErrorText, Field, Input, Loading, LoadingRow,
  Modal, PageHead, Pill, ScoreBar, SearchInput, Spinner, Stat, StatusPill, Table, Td, Textarea, Tr, copyText, cx, useData, useToast,
} from '../../components/ui'
import { ClaimedCard, EvidenceCard, ExtractedCard, ReviewHistory, SessionCard, Thumb } from '../../components/SessionCard'
import { docLabel, fullName, pct, reasonText, statusInfo, timeAgo, waited } from '../../lib/format'

/** "+12%" against the window before, or nothing when there is nothing to compare. */
function change(now: number | null, before: number | null, asPoints = false) {
  if (now === null || before === null) return null
  if (asPoints) {
    const d = (now - before) * 100
    return Math.abs(d) < 0.05 ? 'Same as before' : `${d > 0 ? '+' : ''}${d.toFixed(1)} pts vs the 14 days before`
  }
  if (!before) return now ? 'New this period' : null
  const d = ((now - before) / before) * 100
  return `${d > 0 ? '+' : ''}${d.toFixed(0)}% vs the 14 days before`
}

const seconds = (s: number | null) => (s === null ? '—' : s >= 120 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(0)} s`)

export function AdminOverview() {
  const nav = useNavigate()
  const { data: d, error, loading, reload } = useData(() => adminOverview(), [])
  if (loading && !d) return <Loading />
  if (error && !d) return <ErrorState message={error} onRetry={reload} />
  const o = d!
  const max = Math.max(1, ...o.series.map(x => x.passed + x.failed + x.other))
  return (
    <>
      <PageHead title="Overview" sub={`All clients · last ${o.days} days`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Verifications" value={(o.verifications.value ?? 0).toLocaleString()} note={change(o.verifications.value, o.verifications.previous) ?? 'Started in this period'} />
        <Stat label="Pass rate" value={o.passRate.value === null ? '—' : pct(o.passRate.value)} note={change(o.passRate.value, o.passRate.previous, true) ?? 'Of those decided'} />
        <Stat label="Median completion" value={seconds(o.completionSeconds.value)} note="Link opened to decision" />
        <Stat label="Waiting for review" value={o.awaiting.count} note={o.awaiting.oldest_at ? `Oldest: ${waited(o.awaiting.oldest_at)}` : 'Queue is empty'} tone={o.awaiting.count ? 'warn' : undefined} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHead title="Verifications per day">
            <div className="flex gap-3.5 text-[12.5px] text-muted">
              {[['Verified', 'bg-ok-fill'], ['Declined', 'bg-bad-fill'], ['Other', 'bg-line']].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5"><i className={cx('size-2.5 rounded-[3px]', c)} />{l}</span>
              ))}
            </div>
          </CardHead>
          <div className="flex h-[170px] items-end gap-2">
            {o.series.map(x => {
              const t = x.passed + x.failed + x.other
              return (
                <div key={x.label} title={`${x.label}: ${t} (${x.passed} verified, ${x.failed} declined)`} className="flex min-w-2 flex-1 flex-col-reverse overflow-hidden rounded-t-[5px]" style={{ height: `${(t / max) * 100}%` }}>
                  <span className="bg-ok-fill" style={{ flex: x.passed }} /><span className="bg-bad-fill" style={{ flex: x.failed }} /><span className="bg-line" style={{ flex: x.other }} />
                </div>
              )
            })}
          </div>
          {o.series.length > 0 && <div className="mt-2 flex justify-between text-[12.5px] text-muted"><span>{o.series[0].label}</span><span>{o.series[o.series.length - 1].label}</span></div>}
        </Card>
        <Card>
          <CardHead title="Top decline reasons" />
          {o.topReasons.length === 0 && <p className="text-muted">Nothing declined in this period.</p>}
          <div className="flex flex-col gap-3">
            {o.topReasons.map(([r, n]) => (
              <div key={r} title={reasonText[r]}>
                <div className="flex justify-between text-[12.5px]"><span className="font-mono">{r}</span><b>{n}</b></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist"><i className="block h-full rounded-full bg-bad-fill" style={{ width: `${(n / o.topReasons[0][1]) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Waiting longest</h3>
        <Link to="/admin/review" className="flex items-center gap-1 text-[12.5px] font-semibold text-brand">Open review queue <ArrowRight size={14} /></Link>
      </div>
      <QueueTable rows={o.oldest} onOpen={id => nav(`/admin/review/${id}`)} />
    </>
  )
}

function QueueTable({ rows, onOpen }: { rows: Verification[]; onOpen: (id: string) => void }) {
  return (
    <Table head={['Case', 'Applicant', 'Client', 'Reason', 'Waiting', '']}>
      {rows.length === 0 && <EmptyRow cols={6}>The queue is empty. Nice work.</EmptyRow>}
      {rows.map(v => (
        <Tr key={v.id} onClick={() => onOpen(v.id)}>
          <Td mono>{v.reference}</Td>
          <Td><div className="flex items-center gap-2.5"><Avatar name={fullName(v.applicant)} /><b>{fullName(v.applicant)}</b></div></Td>
          <Td muted>{v.client_name}</Td>
          <Td>{v.reasons[0] ? <span title={reasonText[v.reasons[0]]}><CodeChip tone="warn">{v.reasons[0]}</CodeChip></span> : <Pill tone="warn">Manual check</Pill>}</Td>
          <Td muted>{waited(v.completed_at ?? v.created_at)}</Td>
          <Td><ChevronRight size={16} className="text-faint" /></Td>
        </Tr>
      ))}
    </Table>
  )
}

export function ReviewQueue() {
  const nav = useNavigate()
  const { data, error, loading, reload } = useData(() => reviewQueue(), [])
  return (
    <>
      <PageHead title="Review queue" sub={data ? `${data.length} verification${data.length === 1 ? '' : 's'} need a decision. Oldest first.` : 'Loading…'}>
        {data && data.length > 0 && <Button variant="primary" onClick={() => nav(`/admin/review/${data[0].id}`)}>Start reviewing <ArrowRight size={16} /></Button>}
      </PageHead>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : data && <QueueTable rows={data} onOpen={id => nav(`/admin/review/${id}`)} />}
    </>
  )
}

// Steps a reviewer can ask the person to do again (the backend's REDOABLE).
const REDOABLE: Record<string, string> = { document: 'Document photos', face: 'Face check', address: 'Proof of address', due_diligence: 'Questionnaire' }

export function CaseReview() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { data: v, error, loading, reload } = useData(() => getStaffVerification(id), [id])
  const queue = useData(() => reviewQueue(), [])
  const [action, setAction] = useState<Decision>('approved')
  const [note, setNote] = useState('')
  const [steps, setSteps] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [reopened, setReopened] = useState<string | null>(null)
  if (loading && !v) return <Loading />
  if (error && !v) return <ErrorState message={error} onRetry={reload} />
  const c = v!
  const decidable = c.status === 'needs_review'
  const redoable = c.services.filter(s => s in REDOABLE)
  const pos = (queue.data || []).findIndex(x => x.id === c.id)
  const next = () => (queue.data || []).find(x => x.id !== c.id)
  const goNext = () => { const n = next(); setNote(''); setSteps([]); setAction('approved'); nav(n ? `/admin/review/${n.id}` : '/admin/review') }

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const res = await decide(c.id, action, note, steps)
      toast(`${c.reference} ${action === 'approved' ? 'approved' : action === 'declined' ? 'declined' : 'sent back to the applicant'}. ${c.client_name} has been notified.`)
      if (action === 'redo' && res.session_url) setReopened(res.session_url)
      else goNext()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const face = c.checks.find(x => x.name === 'face_match')
  const docPortrait = c.evidence.find(e => (e.kind as string) === 'document_portrait')?.url
  const live = c.evidence.find(e => e.kind === 'portrait')?.url
  const tone = face?.status === 'pass' ? 'ok' : face?.status === 'review' ? 'warn' : 'bad'
  return (
    <>
      <Crumb to="/admin/review">Review queue</Crumb>
      <PageHead center
        title={<span className="flex flex-wrap items-center gap-2.5"><Avatar name={fullName(c.applicant)} lg /><span className="text-2xl">{fullName(c.applicant)}</span><StatusPill status={c.status} /></span>}
        sub={<span className="text-[12.5px]"><span className="font-mono">{c.reference}</span> · {c.client_name}{c.document_type && ` · ${docLabel[c.document_type]}`} · Waiting {waited(c.completed_at ?? c.created_at)}</span>}>
        {pos >= 0 && <span className="text-[12.5px] text-muted">Case {pos + 1} of {queue.data!.length}</span>}
      </PageHead>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          {face && (
            <Card>
              <CardHead title="Face comparison">{face.reasons[0] && <CodeChip tone="warn">{face.reasons[0]}</CodeChip>}</CardHead>
              <div className="flex flex-wrap items-center justify-center gap-7">
                <figure className="m-0 w-[200px]"><Thumb src={docPortrait} alt="Document portrait" tall /><figcaption className="mt-1.5 text-center text-[12.5px] text-muted">Document portrait</figcaption></figure>
                <div className="flex w-40 flex-col items-center gap-1">
                  <span className="text-[12.5px] text-muted">Similarity</span>
                  <span className={cx('font-display text-4xl font-bold', tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-bad')}>{face.score?.toFixed(2) ?? '—'}</span>
                  {face.score !== undefined && face.threshold !== undefined && <ScoreBar score={face.score} threshold={face.threshold} tone={tone} className="w-[150px]" />}
                  {face.threshold !== undefined && <span className="text-[12.5px] text-muted">Threshold {face.threshold}</span>}
                </div>
                <figure className="m-0 w-[200px]"><Thumb src={live} alt="Live capture" tall /><figcaption className="mt-1.5 text-center text-[12.5px] text-muted">Live capture</figcaption></figure>
              </div>
              {face.status === 'review' && <div className="mt-4"><Banner tone="warn" icon={<AlertTriangle size={16} />}>{reasonText.FACE_MATCH_BORDERLINE}, so it was sent for review instead of failing.</Banner></div>}
            </Card>
          )}
          <SessionCard v={c} />
          <ExtractedCard v={c} />
          <ReviewHistory v={c} />
        </div>
        <div className="flex flex-col gap-4 xl:sticky xl:top-5">
          <Card className="flex flex-col gap-3.5">
            <span className="text-[15px] font-semibold">{decidable ? 'Your decision' : 'Decision'}</span>
            {!decidable ? (
              <p className="text-muted">This case is no longer waiting for review: it is <b className="text-ink">{statusInfo[c.status].label}</b>.</p>
            ) : !canReview() ? (
              <p className="text-muted">Your role can look at cases but not decide them. Ask an owner, admin or reviewer.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {([['approved', 'Approve', Check, 'ok'], ['declined', 'Decline', X, 'bad']] as const).map(([k, l, I, t]) => (
                    <DecisionOption key={k} on={action === k} tone={t} onClick={() => setAction(k)}><I size={18} /><b>{l}</b></DecisionOption>
                  ))}
                </div>
                {redoable.length > 0 && <DecisionOption on={action === 'redo'} onClick={() => { setAction('redo'); if (!steps.length) setSteps(redoable) }}><RefreshCw size={16} /> Ask the applicant to redo steps</DecisionOption>}
                {action === 'redo' && (
                  <div className="flex flex-col gap-2 rounded-xl bg-mist p-3">
                    <span className="text-[13px] font-medium text-body">Steps to do again</span>
                    {redoable.map(s => (
                      <label key={s} className="flex cursor-pointer items-center gap-2.5">
                        <input type="checkbox" className="size-4 accent-ink" checked={steps.includes(s)} onChange={e => setSteps(e.target.checked ? [...steps, s] : steps.filter(x => x !== s))} />
                        {REDOABLE[s]}
                      </label>
                    ))}
                  </div>
                )}
                <Field label={action === 'declined' ? 'Note (required)' : 'Note'} hint="Kept in the audit log with your name and the time. Visible to the client.">
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What did you compare, and why did you decide this way?" />
                </Field>
                {err && <ErrorText>{err}</ErrorText>}
                <Button variant={action === 'declined' ? 'danger' : 'primary'} size="lg" block disabled={busy} onClick={submit}>{busy ? <Spinner sm /> : 'Submit decision'}</Button>
              </>
            )}
          </Card>
          <EvidenceCard v={c} />
          <ClaimedCard v={c} />
        </div>
      </div>
      <Modal open={!!reopened} onClose={() => { setReopened(null); goNext() }} width={480}>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg">Link reopened</h2>
          <p className="text-muted">The applicant can use the same link again. The client has been told; you can also send it yourself.</p>
          <div className="flex gap-2">
            <Input readOnly value={reopened ?? ''} className="font-mono" onFocus={e => e.target.select()} />
            <Button onClick={() => { copyText(reopened!); toast('Link copied') }}><Copy size={16} /> Copy</Button>
          </div>
          <div className="flex justify-end"><Button variant="primary" onClick={() => { setReopened(null); goNext() }}>Next case</Button></div>
        </div>
      </Modal>
    </>
  )
}

function DecisionOption({ on, tone, onClick, children }: { on: boolean; tone?: 'ok' | 'bad'; onClick: () => void; children: React.ReactNode }) {
  // Like the document-type choices on the verification pages: Paper pills that
  // take a coloured edge when chosen.
  const chosen = tone === 'ok' ? 'border-ok bg-ok-tint text-ok' : tone === 'bad' ? 'border-bad bg-bad-tint text-bad' : 'border-brand bg-white text-brand'
  return (
    <button type="button" onClick={onClick}
      className={cx('flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-colors', on ? chosen : 'border-tint bg-tint text-ink hover:border-brand')}>
      {children}
    </button>
  )
}

const FILTERS: Array<VerificationStatus | 'all'> = ['all', 'needs_review', 'passed', 'failed', 'in_progress', 'pending', 'expired']

export function AdminVerifications() {
  const nav = useNavigate()
  const [status, setStatus] = useState<VerificationStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useData(() => adminVerifications({ status, q, page }), [status, q, page])
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  return (
    <>
      <PageHead title="Verifications" sub="Every verification across all clients, newest first." />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput className="w-full sm:w-[300px]" placeholder="Search name, reference, email or client" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(s => <Chip key={s} active={status === s} count={data?.counts[s]} onClick={() => { setStatus(s); setPage(1) }}>{s === 'all' ? 'All' : statusInfo[s].label}</Chip>)}
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <Table head={['Reference', 'Applicant', 'Client', 'Document', 'Created', 'Status', '']}>
        {loading && !data && <LoadingRow cols={7} />}
        {data?.rows.length === 0 && <EmptyRow cols={7}>No verifications match.</EmptyRow>}
        {data?.rows.map(v => (
          <Tr key={v.id} onClick={() => nav(v.status === 'needs_review' ? `/admin/review/${v.id}` : `/admin/verifications/${v.id}`)}>
            <Td mono>{v.reference}</Td>
            <Td><b>{fullName(v.applicant)}</b></Td>
            <Td muted>{v.client_name}</Td>
            <Td muted>{v.document_type ? docLabel[v.document_type] : '—'}</Td>
            <Td muted>{timeAgo(v.created_at)}</Td>
            <Td><StatusPill status={v.status} /></Td>
            <Td><ChevronRight size={16} className="text-faint" /></Td>
          </Tr>
        ))}
      </Table>
      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-[12.5px] text-muted">
          <span>{(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}</span>
          {pages > 1 && <div className="flex gap-2"><Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>}
        </div>
      )}
    </>
  )
}

export function Clients() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | Client['status']>('all')
  const { data, error, loading, reload } = useData(() => listClients({ q, status }), [q, status])
  const [suspend, setSuspend] = useState<Client | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const manage = canManage()

  const apply = async (c: Client, to: Client['status'], why?: string) => {
    setBusy(true)
    try {
      await setClientStatus(c.id, to, why)
      toast(`${c.name} ${to === 'suspended' ? 'suspended' : 'reactivated'}`)
      setSuspend(null); setReason('')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  const ov = data?.overview
  return (
    <>
      <PageHead title="Clients" sub="Businesses using Zener ID." />
      {ov && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label="Clients" value={ov.clients - ov.staff} note={`Plus ${ov.staff} staff account${ov.staff === 1 ? '' : 's'}`} />
          <Stat label="Suspended accounts" value={ov.suspended} note="Cannot sign in or call the API" tone={ov.suspended ? 'bad' : undefined} />
          <Stat label="Active API keys" value={ov.active_keys} note="Across every client" />
          <Stat label="Verifications" value={ov.verifications.toLocaleString()} note="All time" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput className="w-full sm:w-[300px]" placeholder="Search name, email or phone" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'suspended'] as const).map(s => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Suspended'}</Chip>)}
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <Table head={['Client', 'Plan', 'Verifications', 'Pass rate', 'Keys', 'Last sign-in', 'Status', '']}>
        {loading && !data && <LoadingRow cols={8} />}
        {data?.rows.length === 0 && <EmptyRow cols={8}>{q || status !== 'all' ? 'No clients match.' : 'No clients yet. They appear here when a business registers.'}</EmptyRow>}
        {data?.rows.map(c => (
          <Tr key={c.id}>
            <Td><div className="flex items-center gap-2.5"><Avatar name={c.name} /><div className="min-w-0"><b>{c.name}</b><div className="truncate text-[12.5px] text-muted">{c.email}{c.country && ` · ${c.country}`}</div></div></div></Td>
            <Td><Pill tone="info" dot={false}>{c.plan === 'payg' ? 'Pay as you go' : c.plan[0].toUpperCase() + c.plan.slice(1)}</Pill></Td>
            <Td right>{c.verifications.toLocaleString()}</Td>
            <Td right>{c.passRate === undefined ? '—' : pct(c.passRate)}</Td>
            <Td right>{c.keys}</Td>
            <Td muted className="whitespace-nowrap">{c.last_login_at ? timeAgo(c.last_login_at) : 'Never'}</Td>
            <Td>{c.status === 'active' ? <Pill tone="ok">Active</Pill> : <Pill tone="bad">Suspended</Pill>}</Td>
            <Td right>
              {manage && (c.status === 'active'
                ? <Button variant="ghost" size="sm" className="text-bad" onClick={() => setSuspend(c)}>Suspend</Button>
                : <Button variant="ghost" size="sm" disabled={busy} onClick={() => apply(c, 'active')}>Reactivate</Button>)}
            </Td>
          </Tr>
        ))}
      </Table>
      <Modal open={!!suspend} onClose={() => setSuspend(null)} width={460}>
        <div className="flex flex-col gap-3.5">
          <Avatar lg className="bg-bad-tint text-bad"><AlertTriangle size={20} /></Avatar>
          <h2 className="text-lg">Suspend {suspend?.name}?</h2>
          <p className="text-muted">They can no longer sign in, and their API keys stop working straight away. Their verifications are kept. You can reactivate them later.</p>
          <Field label="Reason" hint="Kept in the audit log.">
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Unpaid invoices" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setSuspend(null)}>Cancel</Button>
            <Button variant="danger" disabled={busy} onClick={() => apply(suspend!, 'suspended', reason)}>{busy ? <Spinner sm /> : 'Suspend client'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
