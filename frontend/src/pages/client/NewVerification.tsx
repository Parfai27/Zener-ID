import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Copy, ExternalLink, Mail, Send } from 'lucide-react'
import { createVerification, fmtDate, resendLink } from '../../api'
import type { Verification } from '../../api/types'
import { Qr, Spinner, StatusPill, copyText, useToast } from '../../components/ui'
import { fullName } from '../../lib/format'

export function NewVerification() {
  const [created, setCreated] = useState<Verification | null>(null)
  return created ? <Created v={created} onAnother={() => setCreated(null)} /> : <Form onCreated={setCreated} />
}

function Form({ onCreated }: { onCreated: (v: Verification) => void }) {
  const nav = useNavigate()
  const [f, setF] = useState({ first_name: '', last_name: '', date_of_birth: '', email: '', reference: '', ttl_days: 7 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'ttl_days' ? Number(e.target.value) : e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.first_name.trim()) errs.first_name = 'Required'
    if (!f.last_name.trim()) errs.last_name = 'Required'
    if (!f.date_of_birth) errs.date_of_birth = 'Required'
    else if (new Date(f.date_of_birth) > new Date()) errs.date_of_birth = 'Cannot be in the future'
    if (f.email && !f.email.includes('@')) errs.email = 'Not a valid email'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true); setError('')
    try {
      onCreated(await createVerification({ applicant: { first_name: f.first_name, last_name: f.last_name, date_of_birth: f.date_of_birth, email: f.email || undefined }, reference: f.reference || undefined, ttl_days: f.ttl_days }))
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const field = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={f[k] as string} onChange={up(k)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] ? <span className="error-text">{errors[k]}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  )

  return (
    <>
      <Link to="/app/verifications" className="crumb"><ArrowLeft size={14} /> Verifications</Link>
      <div className="page-head"><div><h1>New verification</h1><p>Enter the applicant’s details. We create a secure link for them to complete the check.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', alignItems: 'start' }}>
        <form className="card col" style={{ gap: 18 }} onSubmit={submit} noValidate>
          <span className="card-title">Applicant</span>
          <div className="grid g2">
            {field('first_name', 'First name', { autoFocus: true })}
            {field('last_name', 'Last name')}
            {field('date_of_birth', 'Date of birth', { type: 'date', max: new Date().toISOString().slice(0, 10) }, 'Must match the document exactly')}
            {field('email', 'Email (optional)', { type: 'email', placeholder: 'We can send the link here' })}
          </div>
          <span className="card-title" style={{ marginTop: 6 }}>Journey</span>
          <div className="grid g2">
            <div className="field">
              <label>Link expires after</label>
              <select className="select" value={f.ttl_days} onChange={up('ttl_days')}>
                {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            {field('reference', 'Your reference (optional)', { placeholder: 'e.g. CUST-20931' }, 'Shown next to the result')}
          </div>
          <div className="field">
            <label>Checks</label>
            <div className="chips">{['Document', 'Name', 'Date of birth', 'Liveness', 'Face match'].map(c => <span key={c} className="pill info plain"><Check size={12} /> {c}</span>)}</div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner sm /> : 'Create verification'}</button>
          </div>
        </form>
        <div className="col" style={{ gap: 16 }}>
          <div className="card col" style={{ gap: 12 }}>
            <span className="card-title">What happens next</span>
            {['We create a secure link that expires', 'The applicant photographs their ID and does a face check', 'You get Verified, Declined or Needs review, with reasons'].map((t, i) => (
              <div key={t} className="row" style={{ alignItems: 'flex-start' }}><span className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{i + 1}</span><span className="small muted">{t}</span></div>
            ))}
          </div>
          <div className="card" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
            <div style={{ fontWeight: 650, marginBottom: 10 }}>Or automate it with the API</div>
            <pre className="mono" style={{ margin: 0, color: '#a9c2ba', whiteSpace: 'pre-wrap' }}>{`POST /v1/verifications
{
  "applicant": {
    "first_name": "Jane",
    "last_name": "Doe",
    "date_of_birth": "1994-03-14"
  }
}`}</pre>
          </div>
        </div>
      </div>
    </>
  )
}

function Created({ v, onAnother }: { v: Verification; onAnother: () => void }) {
  const nav = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState(v.applicant.email || '')
  const [sending, setSending] = useState(false)
  const send = async () => {
    setSending(true)
    try { await resendLink(v.reference, email); toast(`Link sent to ${email}`) } catch (e) { toast((e as Error).message, 'bad') } finally { setSending(false) }
  }
  return (
    <div style={{ display: 'grid', placeItems: 'start center', paddingTop: 12 }}>
      <div className="card raised col" style={{ width: '100%', maxWidth: 720, gap: 22, padding: 32 }}>
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar lg" style={{ background: 'var(--ok-tint)', color: 'var(--ok)' }}><Check size={22} /></span>
          <div className="grow"><h2 style={{ fontSize: 22 }}>Verification created</h2><p className="muted">Share this link with {fullName(v.applicant)}. It expires on {fmtDate(v.expires_at)}.</p></div>
          <StatusPill status={v.status} />
        </div>
        <div className="field">
          <label>Verification link</label>
          <div className="row">
            <input className="input mono grow" readOnly value={v.session_url} onFocus={e => e.target.select()} />
            <button className="btn btn-secondary" onClick={() => { copyText(v.session_url); toast('Link copied') }}><Copy size={16} /> Copy</button>
            <a className="btn btn-secondary" href={v.session_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a>
          </div>
          <span className="hint">Tip: open the link in a new tab to act as the applicant, then come back here to see the result.</span>
        </div>
        <div className="row" style={{ background: 'var(--canvas)', borderRadius: 14, padding: 16, gap: 20 }}>
          <Qr value={v.session_url} size={112} />
          <div className="col" style={{ gap: 4 }}>
            <b>Applicant next to you?</b>
            <span className="small muted">They can scan this code with their phone to start straight away.</span>
            <span className="small muted">(Mock code. It becomes scannable when the backend is connected.)</span>
          </div>
        </div>
        <div className="field">
          <label>Send by email</label>
          <div className="row">
            <div className="input-icon grow"><Mail size={16} /><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="applicant@example.com" /></div>
            <button className="btn btn-primary" onClick={send} disabled={sending || !email}>{sending ? <Spinner sm /> : <><Send size={16} /> Send</>}</button>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 18 }}>
          <button className="btn btn-ghost" onClick={onAnother}>Create another</button>
          <button className="btn btn-secondary" onClick={() => nav(`/app/verifications/${v.reference}`)}>View verification</button>
          <button className="btn btn-primary" onClick={() => nav('/app/verifications')}>Done</button>
        </div>
      </div>
    </div>
  )
}
