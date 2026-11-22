'use client'

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from '@/console/router'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import { adminOverview, adminVerifications, decide, getVerification, listClients, reviewQueue, setClientStatus, staffLogin } from '../../api'
import type { Verification, VerificationStatus } from '../../api/types'
import { AuthSplit } from '../../layouts/Shells'
import { Avatar, ErrorState, Loading, Pill, Spinner, StatusPill, useData, useToast } from '../../components/ui'
import { ClaimedCard, EvidenceCard, ExtractedCard, SessionCard } from '../../components/SessionCard'
import { docLabel, fullName, pct, reasonText, statusInfo, timeAgo, waited } from '../../lib/format'

export function AdminLogin() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [f, setF] = useState({ email: 'grace.uwase@zenerid.com', password: '', code: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await staffLogin(f.email, f.password, f.code); nav(loc.state?.from || '/admin', { replace: true }) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthSplit dark title={<>The <span className="em">admin</span> console.</>}>
      <div><h2 style={{ fontSize: 28, fontWeight: 700 }}>Staff sign in</h2><p className="muted" style={{ marginTop: 4 }}>Use your Zener ID staff account.</p></div>
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="field"><label>Staff email</label><input className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="Any 6+ characters in mock mode" required /></div>
        <div className="field"><label>Authenticator code</label><input className="input mono" inputMode="numeric" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="Any 6 digits in mock mode" required /></div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <Spinner sm /> : 'Sign in to admin console'}</button>
      </form>
      <Link to="/login" className="small" style={{ textAlign: 'center' }}>← Back to client sign in</Link>
    </AuthSplit>
  )
}

export function AdminOverview() {
  const nav = useNavigate()
  const { data, error, loading, reload } = useData(() => adminOverview(), [])
  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const d = data!
  const max = Math.max(...d.days.map(x => x.passed + x.review + x.failed))
  return (
    <>
      <div className="page-head"><div><h1>Overview</h1><p>All clients · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div></div>
      <div className="grid g4">
        {[['Verifications today', d.today.toLocaleString(), '+8% vs last week', 'var(--ok)'], ['Pass rate', pct(d.passRate), 'Across all clients', 'var(--ink-3)'], ['Median decision time', `${d.medianSeconds} s`, 'Target: under 15 s', 'var(--ink-3)'], ['Waiting for review', String(d.queue), d.oldest[0] ? `Oldest: ${waited(d.oldest[0].completed_at)}` : 'Queue is empty', 'var(--warn)']].map(([l, v, n, c]) => (
          <div key={l} className="card stat"><div className="label">{l}</div><div className="value">{v}</div><div className="note" style={{ color: c }}>{n}</div></div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
        <div className="card">
          <div className="card-head"><span className="card-title">Verifications per day</span>
            <div className="row small muted" style={{ gap: 14 }}>{[['Verified', 'var(--ok)'], ['Review', 'var(--warn)'], ['Declined', 'var(--bad)']].map(([l, c]) => <span key={l} className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>)}</div>
          </div>
          <div className="bars">
            {d.days.map(x => {
              const t = x.passed + x.review + x.failed
              return (
                <div key={x.label} title={`${x.label}: ${t}`} style={{ height: `${(t / max) * 100}%` }}>
                  <span style={{ flex: x.passed, background: 'var(--ok)' }} /><span style={{ flex: x.review, background: 'var(--warn)' }} /><span style={{ flex: x.failed, background: 'var(--bad)' }} />
                </div>
              )
            })}
          </div>
          <div className="row between small muted" style={{ marginTop: 8 }}><span>{d.days[0].label}</span><span>{d.days[d.days.length - 1].label}</span></div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">Top decline reasons</span></div>
          <div className="col" style={{ gap: 12 }}>
            {d.topReasons.map(([r, n]) => (
              <div key={r}><div className="row between small"><span className="mono">{r}</span><b>{n}</b></div><div className="hbar" style={{ marginTop: 6 }}><i style={{ width: `${(n / d.topReasons[0][1]) * 100}%` }} /></div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="row between"><h3 style={{ fontSize: 16 }}>Waiting longest</h3><Link to="/admin/review" className="row small" style={{ gap: 4, fontWeight: 600 }}>Open review queue <ArrowRight size={14} /></Link></div>
      <QueueTable rows={d.oldest} onOpen={r => nav(`/admin/review/${r}`)} />
    </>
  )
}

function QueueTable({ rows, onOpen }: { rows: Verification[]; onOpen: (ref: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Case</th><th>Applicant</th><th>Client</th><th>Reason</th><th>Score</th><th>Waiting</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="empty">The queue is empty. Nice work.</td></tr>}
          {rows.map(v => {
            const flagged = v.checks.find(c => c.status === 'review')
            return (
              <tr key={v.id} className="clickable" onClick={() => onOpen(v.reference)}>
                <td className="mono">{v.reference}</td>
                <td><div className="row" style={{ gap: 10 }}><Avatar name={fullName(v.applicant)} /><b>{fullName(v.applicant)}</b></div></td>
                <td className="muted">{v.client_name}</td>
                <td><Pill tone="warn">{flagged ? (flagged.name === 'face_match' ? 'Face match borderline' : flagged.name) : 'Manual check'}</Pill></td>
                <td className="mono muted">{flagged?.score !== undefined ? `${flagged.score.toFixed(2)} / ${flagged.threshold}` : '—'}</td>
                <td className="muted">{waited(v.completed_at)}</td>
                <td><ChevronRight size={16} color="var(--ink-4)" /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ReviewQueue() {
  const nav = useNavigate()
  const { data, error, loading, reload } = useData(() => reviewQueue(), [])
  return (
    <>
      <div className="page-head">
        <div><h1>Review queue</h1><p>{data ? `${data.length} verification${data.length === 1 ? '' : 's'} need a decision. Oldest first.` : 'Loading…'}</p></div>
        {data && data.length > 0 && <button className="btn btn-primary" onClick={() => nav(`/admin/review/${data[0].reference}`)}>Start reviewing <ArrowRight size={16} /></button>}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : data && <QueueTable rows={data} onOpen={r => nav(`/admin/review/${r}`)} />}
    </>
  )
}

export function CaseReview() {
  const { reference = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { data: v, error, loading, reload } = useData(() => getVerification(reference, 'staff'), [reference])
  const queue = useData(() => reviewQueue(), [])
  const [action, setAction] = useState<'approved' | 'declined' | 'redo'>('approved')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (loading && !v) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const c = v!
  const decided = c.status !== 'needs_review'
  const pos = (queue.data || []).findIndex(x => x.reference === c.reference)

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      await decide(c.reference, action, note)
      toast(`${c.reference} ${action === 'approved' ? 'approved' : action === 'declined' ? 'declined' : 'sent back to the applicant'}. ${c.client_name} has been notified.`)
      const next = (queue.data || []).find(x => x.reference !== c.reference)
      setNote('')
      nav(next ? `/admin/review/${next.reference}` : '/admin/review')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const face = c.checks.find(x => x.name === 'face_match')
  const portrait = c.evidence.find(e => e.kind === 'portrait')?.url
  const selfie = c.evidence.find(e => e.kind === 'selfie')?.url
  return (
    <>
      <Link to="/admin/review" className="crumb"><ArrowLeft size={14} /> Review queue</Link>
      <div className="page-head" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={fullName(c.applicant)} lg />
          <div>
            <div className="row" style={{ gap: 10 }}><h1 style={{ fontSize: 24 }}>{fullName(c.applicant)}</h1><StatusPill status={c.status} /></div>
            <p className="small"><span className="mono">{c.reference}</span> · {c.client_name}{c.document_type && ` · ${docLabel[c.document_type]}`} · Waiting {waited(c.completed_at)}</p>
          </div>
        </div>
        {pos >= 0 && <span className="muted small">Case {pos + 1} of {queue.data!.length}</span>}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          {face && (
            <div className="card">
              <div className="card-head"><span className="card-title">Face comparison</span>{face.reasons[0] && <span className="code-chip warn">{face.reasons[0]}</span>}</div>
              <div className="row" style={{ justifyContent: 'center', gap: 28 }}>
                <figure style={{ margin: 0, width: 200 }}><div className="thumb" style={{ aspectRatio: '4/5' }}>{portrait && <img src={portrait} alt="Document portrait" />}</div><figcaption className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>Document portrait</figcaption></figure>
                <div className="col" style={{ alignItems: 'center', gap: 4, width: 160 }}>
                  <span className="small muted">Similarity</span>
                  <span style={{ fontSize: 36, fontWeight: 750, color: face.status === 'pass' ? 'var(--ok)' : face.status === 'review' ? 'var(--warn)' : 'var(--bad)' }}>{face.score?.toFixed(2)}</span>
                  <div className="score" style={{ width: 150 }}><i style={{ width: `${(face.score || 0) * 100}%`, background: 'var(--warn)' }} /><b style={{ left: `${(face.threshold || 0) * 100}%` }} /></div>
                  <span className="small muted">Threshold {face.threshold}</span>
                </div>
                <figure style={{ margin: 0, width: 200 }}><div className="thumb" style={{ aspectRatio: '4/5' }}>{selfie && <img src={selfie} alt="Live capture" />}</div><figcaption className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>Live capture</figcaption></figure>
              </div>
              {face.status === 'review' && <div className="banner warn" style={{ marginTop: 16 }}><AlertTriangle size={16} /><div>{reasonText.FACE_MATCH_BORDERLINE}, so it was sent for review instead of failing.</div></div>}
            </div>
          )}
          <SessionCard v={c} />
          <ExtractedCard v={c} />
        </div>
        <div className="col" style={{ gap: 16, position: 'sticky', top: 20 }}>
          <div className="card col" style={{ gap: 14 }}>
            <span className="card-title">{decided ? 'Decision' : 'Your decision'}</span>
            {decided ? (
              <p className="muted">This case was already decided: <b>{statusInfo[c.status].label}</b>.</p>
            ) : (
              <>
                <div className="grid g2" style={{ gap: 8 }}>
                  {([['approved', 'Approve', Check, 'ok'], ['declined', 'Decline', X, 'bad']] as const).map(([k, l, I, t]) => (
                    <button key={k} className="option" style={{ justifyContent: 'center', ...(action === k ? { border: `2px solid var(--${t})`, background: `var(--${t}-tint)`, padding: '13px 15px', color: `var(--${t})` } : {}) }} onClick={() => setAction(k)}>
                      <I size={18} /><b>{l}</b>
                    </button>
                  ))}
                </div>
                <button className={`option${action === 'redo' ? ' selected' : ''}`} style={{ justifyContent: 'center' }} onClick={() => setAction('redo')}><RefreshCw size={16} /> Ask applicant to retry</button>
                <div className="field">
                  <label>Note (required)</label>
                  <textarea className="textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="What did you compare, and why did you decide this way?" />
                  <span className="hint">Logged with your name and the time. Visible to the client.</span>
                </div>
                {err && <div className="error-text">{err}</div>}
                <button className={`btn btn-lg btn-block ${action === 'declined' ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={submit}>{busy ? <Spinner sm /> : 'Submit decision'}</button>
              </>
            )}
          </div>
          <EvidenceCard v={c} />
          <ClaimedCard v={c} />
        </div>
      </div>
    </>
  )
}

export function AdminVerifications() {
  const nav = useNavigate()
  const [status, setStatus] = useState<VerificationStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const { data, error, loading, reload } = useData(() => adminVerifications({ status, q }), [status, q])
  return (
    <>
      <div className="page-head"><div><h1>Verifications</h1><p>Every verification across all clients.</p></div></div>
      <div className="row wrap">
        <div className="input-icon" style={{ width: 300 }}><Search size={16} /><input className="input" placeholder="Search name, reference or client" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="chips">{(['all', 'passed', 'failed', 'needs_review', 'in_progress', 'pending'] as const).map(s => <button key={s} className={`chip${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : statusInfo[s].label}</button>)}</div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reference</th><th>Applicant</th><th>Client</th><th>Document</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan={6}><Loading /></td></tr>}
            {data?.map(v => (
              <tr key={v.id} className="clickable" onClick={() => nav(v.status === 'needs_review' ? `/admin/review/${v.reference}` : `/admin/verifications/${v.reference}`)}>
                <td className="mono">{v.reference}</td>
                <td><b>{fullName(v.applicant)}</b></td>
                <td className="muted">{v.client_name}</td>
                <td className="muted">{v.document_type ? docLabel[v.document_type] : '—'}</td>
                <td className="muted">{timeAgo(v.created_at)}</td>
                <td><StatusPill status={v.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Clients() {
  const toast = useToast()
  const { data, error, loading, reload } = useData(() => listClients(), [])
  return (
    <>
      <div className="page-head"><div><h1>Clients</h1><p>Businesses using Zener ID.</p></div></div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Client</th><th>Plan</th><th style={{ textAlign: 'right' }}>Verifications</th><th style={{ textAlign: 'right' }}>Pass rate</th><th style={{ textAlign: 'right' }}>Active keys</th><th>Status</th><th /></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan={7}><Loading /></td></tr>}
            {data?.map(c => (
              <tr key={c.id}>
                <td><div className="row" style={{ gap: 10 }}><Avatar name={c.name} /><div><b>{c.name}</b><div className="small muted">{c.email}</div></div></div></td>
                <td><Pill tone="info">{c.plan}</Pill></td>
                <td style={{ textAlign: 'right' }}>{c.verifications}</td>
                <td style={{ textAlign: 'right' }}>{c.verifications ? pct(c.passRate) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{c.keys}</td>
                <td>{c.status === 'active' ? <Pill tone="ok">Active</Pill> : <Pill tone="bad">Suspended</Pill>}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await setClientStatus(c.id, c.status === 'active' ? 'suspended' : 'active'); toast(`${c.name} ${c.status === 'active' ? 'suspended' : 'reactivated'}`) }}>
                    {c.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
