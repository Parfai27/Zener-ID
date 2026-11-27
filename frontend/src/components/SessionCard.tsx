import { CalendarCheck, Fingerprint, IdCard, ScanFace, UserRound, FileImage, Lock } from 'lucide-react'
import type { Check, Verification } from '../api/types'
import { checkInfo, dateTime, docLabel, fmtDate, resultWord, statusInfo } from '../lib/format'
import { Avatar, Card, CardHead, CodeChip, Kv, ScoreBar, TEXT, cx } from './ui'

const icons = { doc: IdCard, name: UserRound, dob: CalendarCheck, live: Fingerprint, face: ScanFace }

const Row = ({ top, children }: { top?: boolean; children: React.ReactNode }) => (
  <div className={cx('flex gap-3.5 border-b border-line px-5 py-[13px] last:border-b-0', top ? 'items-start' : 'items-center')}>{children}</div>
)
const RowIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="grid size-9 flex-none place-items-center rounded-full bg-tint text-brand">{children}</div>
)
const What = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="min-w-0 flex-1"><b className="block font-semibold">{title}</b>{children}</div>
)

/** Shufti-style session card: ID and status, then one row per check with a short result word. */
export function SessionCard({ v }: { v: Verification }) {
  const s = statusInfo[v.status]
  return (
    <Card className="overflow-hidden !p-0 sm:!p-0">
      <div className="grid grid-cols-2 border-b border-line">
        <div className="px-5 py-3.5"><Label>Session ID</Label><div className="mt-0.5 font-mono text-sm font-bold">{v.reference}</div></div>
        <div className="border-l border-line px-5 py-3.5"><Label>Status</Label><div className={cx('mt-0.5 text-sm font-bold', TEXT[s.tone === 'info' ? 'muted' : s.tone])}>{s.label}</div></div>
      </div>
      {v.checks.length === 0 && (
        <Row>
          <What title="No checks yet">
            <span className="text-[13px] text-muted">{v.status === 'pending' ? 'The applicant has not opened the link.' : v.status === 'expired' ? 'The link expired before the applicant finished.' : 'The applicant is part-way through the flow.'}</span>
          </What>
        </Row>
      )}
      {v.checks.map(c => <CheckRow key={c.name} c={c} />)}
      {v.liveness_attempts > 0 && (
        <Row>
          <RowIcon><Fingerprint size={17} /></RowIcon>
          <What title="Face check attempts"><span className="text-[13px] text-muted">Applicants get up to 5 tries</span></What>
          <span className="text-[13px] font-bold text-ink">{v.liveness_attempts} of 5</span>
        </Row>
      )}
    </Card>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11.5px] font-medium uppercase tracking-wider text-muted">{children}</div>
)

function CheckRow({ c }: { c: Check }) {
  const info = checkInfo[c.name as keyof typeof checkInfo] ?? { label: c.label ?? c.name, ok: 'Pass', icon: 'doc' }
  const Icon = icons[info.icon as keyof typeof icons]
  const r = resultWord(c.name, c.status)
  const showScore = c.score !== undefined && c.threshold !== undefined
  return (
    <Row top={showScore}>
      <RowIcon><Icon size={17} /></RowIcon>
      <What title={info.label}>
        <span className="text-[13px] text-muted">{c.summary}</span>
        {showScore && <ScoreBar score={c.score!} threshold={c.threshold!} tone={r.tone} className="max-w-[300px]" />}
        {c.reasons.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{c.reasons.map(x => <CodeChip key={x} tone={r.tone === 'warn' ? 'warn' : 'bad'}>{x}</CodeChip>)}</div>}
      </What>
      <span className={cx('text-[13px] font-bold', TEXT[r.tone])}>{r.word}</span>
    </Row>
  )
}

export function EvidenceCard({ v }: { v: Verification }) {
  return (
    <Card>
      <CardHead title="Captured files"><span className="flex items-center gap-1 text-[12.5px] text-muted"><Lock size={12} /> Private</span></CardHead>
      {v.evidence.length === 0 && <p className="text-[12.5px] text-muted">Nothing captured yet.</p>}
      <div className="grid grid-cols-2 gap-2.5">
        {v.evidence.map(f => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="text-inherit no-underline">
            <Thumb src={f.url} alt={f.name} />
            <div className="mt-1.5 flex justify-between gap-2 text-[12.5px]">
              <span className="truncate font-mono">{f.name}</span>
              <span className="flex-none text-muted">{f.size_kb} KB</span>
            </div>
          </a>
        ))}
      </div>
    </Card>
  )
}

/** A captured image, or a placeholder when there is none. */
export function Thumb({ src, alt, tall }: { src?: string; alt: string; tall?: boolean }) {
  return (
    <div className={cx('grid place-items-center overflow-hidden rounded-md bg-mist text-faint ring-1 ring-line', tall ? 'aspect-[4/5]' : 'aspect-[4/3]')}>
      {src ? <img src={src} alt={alt} className="block size-full object-cover" /> : <FileImage size={28} />}
    </div>
  )
}

export function ExtractedCard({ v }: { v: Verification }) {
  const d = v.document
  return (
    <Card>
      <CardHead title="Identity signals" />
      {!d && <p className="text-[12.5px] text-muted">The document has not been read yet.</p>}
      {d && (
        <>
          <Kv k="Document" v={`${docLabel[d.document_type]} · ${d.nationality}`} />
          <Kv k="Number" v={d.number} mono />
          {d.full_name !== undefined ? <Kv k="Name" v={d.full_name} /> : <>
            <Kv k="Surname" v={d.surname ?? '—'} />
            <Kv k="Given names" v={d.given_names ?? '—'} />
          </>}
          <Kv k="Date of birth" v={fmtDate(d.date_of_birth)} />
          <Kv k="Expiry" v={fmtDate(d.expiry_date)} />
          {d.mrz_valid !== undefined && <Kv k="MRZ check digits" v={d.mrz_valid ? 'Valid' : 'Invalid'} tone={d.mrz_valid ? 'ok' : 'bad'} />}
          {d.decision && <Kv k="Document check" v={d.decision === 'pass' ? 'Passed' : d.decision === 'fail' ? 'Failed' : d.decision === 'review' ? 'Needs review' : d.decision} tone={d.decision === 'pass' ? 'ok' : d.decision === 'fail' ? 'bad' : undefined} />}
        </>
      )}
    </Card>
  )
}

export function ClaimedCard({ v }: { v: Verification }) {
  return (
    <Card>
      <CardHead title="Submitted details" />
      <Kv k="First name" v={v.applicant.first_name || '—'} />
      <Kv k="Last name" v={v.applicant.last_name || '—'} />
      <Kv k="Date of birth" v={fmtDate(v.applicant.date_of_birth || undefined)} />
      {v.applicant.email && <Kv k="Email" v={v.applicant.email} />}
      <Kv k="Created" v={dateTime(v.created_at)} />
      <Kv k="Link expires" v={dateTime(v.expires_at || undefined)} />
    </Card>
  )
}

export function ReviewHistory({ v }: { v: Verification }) {
  if (!v.reviews.length) return null
  const word = { approved: 'approved', declined: 'declined', redo: 'asked for a redo' }
  return (
    <Card>
      <CardHead title="Review history" />
      {v.reviews.map((r, i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <Avatar name={r.by} />
          <div className="min-w-0 flex-1"><b>{r.by}</b> <span className="text-muted">{word[r.action] ?? r.action} · {dateTime(r.at)}</span>{r.note && <p className="mt-0.5 text-[12.5px]">{r.note}</p>}</div>
        </div>
      ))}
    </Card>
  )
}
