import { CalendarCheck, Fingerprint, IdCard, ScanFace, UserRound, FileImage, Lock } from 'lucide-react'
import { fmtDate } from '../api'
import type { Check, Verification } from '../api/types'
import { checkInfo, dateTime, docLabel, resultWord, statusInfo } from '../lib/format'

const icons = { doc: IdCard, name: UserRound, dob: CalendarCheck, live: Fingerprint, face: ScanFace }

/** Shufti-style session card: ID + status, then one row per check with a short result word. */
export function SessionCard({ v }: { v: Verification }) {
  const s = statusInfo[v.status]
  return (
    <div className="card session-card">
      <div className="sc-head">
        <div><div className="sc-k">Session ID</div><div className="sc-v mono" style={{ fontSize: 14 }}>{v.reference}</div></div>
        <div><div className="sc-k">Status</div><div className={`sc-v result-word ${s.tone === 'info' ? 'muted' : s.tone}`} style={{ fontSize: 14 }}>{s.label}</div></div>
      </div>
      {v.checks.length === 0 && (
        <div className="sc-row"><div className="what"><b>No checks yet</b><span>{v.status === 'pending' ? 'The applicant has not opened the link.' : v.status === 'expired' ? 'The link expired before the applicant finished.' : 'The applicant is part-way through the flow.'}</span></div></div>
      )}
      {v.checks.map(c => <CheckRow key={c.name} c={c} />)}
      {v.checks.length > 0 && (
        <div className="sc-row">
          <div className="ic"><Fingerprint size={17} /></div>
          <div className="what"><b>Liveness attempts</b><span>Applicants get up to 3 tries</span></div>
          <span className="result-word muted" style={{ color: 'var(--ink)' }}>{v.liveness_attempts} of 3</span>
        </div>
      )}
    </div>
  )
}

function CheckRow({ c }: { c: Check }) {
  const info = checkInfo[c.name]
  const Icon = icons[info.icon as keyof typeof icons]
  const r = resultWord(c.name, c.status)
  const showScore = c.score !== undefined && c.threshold !== undefined
  return (
    <div className="sc-row" style={{ alignItems: showScore ? 'flex-start' : 'center' }}>
      <div className="ic"><Icon size={17} /></div>
      <div className="what">
        <b>{info.label}</b>
        <span>{c.summary}</span>
        {showScore && (
          <div className="score" style={{ maxWidth: 300 }}>
            <i style={{ width: `${Math.min(1, c.score!) * 100}%`, background: r.tone === 'ok' ? 'var(--ok)' : r.tone === 'warn' ? 'var(--warn)' : 'var(--bad)' }} />
            <b style={{ left: `${c.threshold! * 100}%` }} title={`Threshold ${c.threshold}`} />
          </div>
        )}
        {c.reasons.length > 0 && <div style={{ marginTop: 6 }}>{c.reasons.map(x => <span key={x} className={`code-chip ${r.tone === 'warn' ? 'warn' : 'bad'}`}>{x}</span>)}</div>}
      </div>
      <span className={`result-word ${r.tone}`}>{r.word}</span>
    </div>
  )
}

export function EvidenceCard({ v }: { v: Verification }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Captured files</span><span className="small muted row" style={{ gap: 4 }}><Lock size={12} /> Private</span></div>
      {v.evidence.length === 0 && <p className="muted small">Nothing captured yet.</p>}
      <div className="grid g2" style={{ gap: 10 }}>
        {v.evidence.map(f => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="thumb">{f.url ? <img src={f.url} alt={f.name} /> : <FileImage size={28} />}</div>
            <div className="row between small" style={{ marginTop: 6 }}>
              <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span className="muted" style={{ whiteSpace: 'nowrap', flex: 'none' }}>{f.size_kb} KB</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export function ExtractedCard({ v }: { v: Verification }) {
  const d = v.document
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Identity signals</span></div>
      {!d && <p className="muted small">The document has not been read yet.</p>}
      {d && (
        <>
          <Kv k="Document" v={`${docLabel[d.document_type]} · ${d.nationality}`} />
          <Kv k="Number" v={d.number} mono />
          <Kv k="Surname" v={d.surname} />
          <Kv k="Given names" v={d.given_names} />
          <Kv k="Date of birth" v={fmtDate(d.date_of_birth)} />
          <Kv k="Expiry" v={fmtDate(d.expiry_date)} />
          <Kv k="MRZ check digits" v={d.mrz_valid ? 'Valid' : 'Invalid'} tone={d.mrz_valid ? 'var(--ok)' : 'var(--bad)'} />
        </>
      )}
    </div>
  )
}

export function ClaimedCard({ v }: { v: Verification }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Submitted details</span></div>
      <Kv k="First name" v={v.applicant.first_name} />
      <Kv k="Last name" v={v.applicant.last_name} />
      <Kv k="Date of birth" v={fmtDate(v.applicant.date_of_birth)} />
      {v.applicant.email && <Kv k="Email" v={v.applicant.email} />}
      <Kv k="Created" v={dateTime(v.created_at)} />
      <Kv k="Link expires" v={dateTime(v.expires_at)} />
    </div>
  )
}

export function Kv({ k, v, mono, tone }: { k: string; v: string; mono?: boolean; tone?: string }) {
  return <div className="kv"><span className="k">{k}</span><span className={`v${mono ? ' mono' : ''}`} style={tone ? { color: tone } : undefined}>{v}</span></div>
}
