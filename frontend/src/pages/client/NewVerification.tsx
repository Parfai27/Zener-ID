import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, ExternalLink, Mail } from 'lucide-react'
import { createVerification } from '../../api'
import type { Verification } from '../../api/types'
import { Avatar, Button, Card, Crumb, ErrorText, Field, Input, PageHead, Pill, Select, Spinner, StatusPill, buttonClass, copyText, inputClass, useToast } from '../../components/ui'
import { fmtDate, fullName } from '../../lib/format'

export function NewVerification() {
  const [created, setCreated] = useState<Verification | null>(null)
  return created ? <Created v={created} onAnother={() => setCreated(null)} /> : <Form onCreated={setCreated} />
}

const SectionTitle = ({ children }: { children: string }) => <span className="text-[15px] font-semibold">{children}</span>

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
    if (f.reference.trim() && f.reference.trim().length < 6) errs.reference = 'At least 6 characters'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true); setError('')
    try {
      onCreated(await createVerification({ applicant: { first_name: f.first_name, last_name: f.last_name, date_of_birth: f.date_of_birth, email: f.email || undefined }, reference: f.reference || undefined, ttl_days: f.ttl_days }))
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const field = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <Field label={label} hint={hint} error={errors[k]}>
      <Input value={f[k] as string} onChange={up(k)} aria-invalid={!!errors[k]} {...props} />
    </Field>
  )

  return (
    <>
      <Crumb to="/app/verifications">Verifications</Crumb>
      <PageHead title="New verification" sub="Enter the applicant’s details. We create a secure link for them to complete the check." />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form className="flex flex-col gap-5 rounded-lg bg-white p-5 shadow-card sm:p-6" onSubmit={submit} noValidate>
          <SectionTitle>Applicant</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {field('first_name', 'First name', { autoFocus: true })}
            {field('last_name', 'Last name')}
            {field('date_of_birth', 'Date of birth', { type: 'date', max: new Date().toISOString().slice(0, 10) }, 'Must match the document exactly')}
            {field('email', 'Email (optional)', { type: 'email', placeholder: 'We can send the link here' })}
          </div>
          <SectionTitle>Journey</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Link expires after">
              <Select value={f.ttl_days} onChange={up('ttl_days')}>
                {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
              </Select>
            </Field>
            {field('reference', 'Your reference (optional)', { placeholder: 'e.g. CUST-20931' }, 'At least 6 characters, unique in your account')}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-body">Checks</span>
            <div className="flex flex-wrap gap-2">{['Document', 'Name', 'Date of birth', 'Liveness', 'Face match'].map(c => <Pill key={c} tone="info" dot={false}><Check size={12} /> {c}</Pill>)}</div>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex justify-end gap-3">
            <Button onClick={() => nav(-1)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? <Spinner sm /> : 'Create verification'}</Button>
          </div>
        </form>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <SectionTitle>What happens next</SectionTitle>
            {['We create a secure link that expires', 'The applicant photographs their ID and does a face check', 'You get Verified, Declined or Needs review, with reasons'].map((t, i) => (
              <div key={t} className="flex items-start gap-3"><Avatar className="!size-6 !text-[11px]">{i + 1}</Avatar><span className="text-[12.5px] text-muted">{t}</span></div>
            ))}
          </Card>
          <div className="on-night rounded-lg bg-night p-5 text-white sm:p-6">
            <div className="mb-2.5 font-semibold">Or automate it with the API</div>
            <pre className="m-0 whitespace-pre-wrap font-mono text-[12.5px] text-faint">{`POST /v1/verifications
X-API-Key: <your key>

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
  const canMail = email.includes('@')
  // Opens the person's own mail app with the link written in: the backend does not send it.
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Verify your identity')}&body=${encodeURIComponent(
    `Hello ${v.applicant.first_name},\n\nPlease complete a short identity check: photograph your ID and take a quick face check.\n\n${v.session_url}\n\nThe link works until ${fmtDate(v.expires_at)}.`,
  )}`
  return (
    <div className="grid place-items-start justify-center pt-3">
      <Card raised className="flex w-full max-w-[720px] flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar lg className="bg-ok-tint text-ok"><Check size={22} /></Avatar>
          <div className="min-w-0 flex-1"><h2 className="text-xl">Verification created</h2><p className="text-muted">Share this link with {fullName(v.applicant)}. It expires on {fmtDate(v.expires_at)}.</p></div>
          <StatusPill status={v.status} />
        </div>
        <Field label="Verification link" hint="Tip: open the link in a new tab to act as the applicant, then come back here to see the result.">
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-0 flex-1 font-mono" readOnly value={v.session_url} onFocus={e => e.target.select()} />
            <Button onClick={() => { copyText(v.session_url); toast('Link copied') }}><Copy size={16} /> Copy</Button>
            <a className={buttonClass()} href={v.session_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a>
          </div>
        </Field>
        <div className="flex items-center gap-5 rounded-2xl bg-tint p-4 ring-1 ring-line">
          <img src={`${v.session_url}/qr.svg`} width={112} height={112} alt="QR code for the verification link" className="flex-none rounded-lg bg-white p-1" />
          <div className="flex flex-col gap-1">
            <b>Applicant next to you?</b>
            <span className="text-[12.5px] text-muted">They can scan this code with their phone to start straight away.</span>
          </div>
        </div>
        <Field label="Send by email" hint="Opens your own email app with the message and link ready to send.">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className={`${inputClass} pl-9`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="applicant@example.com" />
            </div>
            <a className={buttonClass('primary')} aria-disabled={!canMail} href={canMail ? mailto : undefined} onClick={() => canMail && toast('Your email app opened with the link written in')}><Mail size={16} /> Write email</a>
          </div>
        </Field>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-[18px]">
          <Button variant="ghost" onClick={onAnother}>Create another</Button>
          <Button onClick={() => nav(`/app/verifications/${v.reference}`)}>View verification</Button>
          <Button variant="primary" onClick={() => nav('/app/verifications')}>Done</Button>
        </div>
      </Card>
    </div>
  )
}
