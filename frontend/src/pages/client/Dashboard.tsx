import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { clientStats, currentSession } from '../../api'
import { ErrorState, Loading, StatusPill, useData } from '../../components/ui'
import { docLabel, fullName, pct, reasonText, timeAgo } from '../../lib/format'

export function Dashboard() {
  const nav = useNavigate()
  const s = currentSession('client')!
  const { data, error, loading, reload } = useData(() => clientStats(), [])
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good to see you, {s.name}</h1>
          <p>Here is how identity checks are going for your customers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/app/verifications/new')}><Plus size={16} /> New verification</button>
      </div>
      {loading && !data && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid g4">
            <Stat label="Verifications" value={data.total} note={`${data.pending} waiting for the applicant`} />
            <Stat label="Verified" value={data.passed} note={`${pct(data.passRate)} pass rate`} tone="var(--ok)" />
            <Stat label="Declined" value={data.failed} note={data.topReasons[0] ? `Top: ${data.topReasons[0][0]}` : 'No declines'} tone="var(--bad)" />
            <Stat label="Median completion" value={data.avgSeconds ? (data.avgSeconds >= 120 ? `${(data.avgSeconds / 60).toFixed(1)} min` : `${data.avgSeconds.toFixed(0)} s`) : '—'} note="Link opened to decision, last 30 days" />
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
            <div className="card">
              <div className="card-head">
                <span className="card-title">Latest verifications</span>
                <Link to="/app/verifications" className="row small" style={{ gap: 4, fontWeight: 600 }}>View all <ArrowRight size={14} /></Link>
              </div>
              {data.recent.length === 0 && (
                <div className="col" style={{ gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
                  <p className="muted" style={{ margin: 0 }}>No verifications yet. Create one and send the link to your customer.</p>
                  <button className="btn btn-secondary" onClick={() => nav('/app/verifications/new')}><Plus size={16} /> New verification</button>
                </div>
              )}
              <table className="table">
                <tbody>
                  {data.recent.map(v => (
                    <tr key={v.id} className="clickable" onClick={() => nav(`/app/verifications/${v.reference}`)}>
                      <td style={{ paddingLeft: 0 }}><b>{fullName(v.applicant)}</b><div className="small muted mono">{v.reference}</div></td>
                      <td className="muted">{v.document_type ? docLabel[v.document_type] : '—'}</td>
                      <td className="muted">{timeAgo(v.created_at)}</td>
                      <td style={{ paddingRight: 0, textAlign: 'right' }}><StatusPill status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-head"><span className="card-title">Why checks were declined</span></div>
              {data.topReasons.length === 0 && <p className="muted">Nothing declined yet.</p>}
              <div className="col" style={{ gap: 14 }}>
                {data.topReasons.map(([code, n]) => (
                  <div key={code}>
                    <div className="row between small"><span className="code-chip bad">{code}</span><b>{n}</b></div>
                    <div className="small muted" style={{ marginTop: 4 }}>{reasonText[code] || code}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="note" style={{ color: tone || 'var(--ink-3)' }}>{note}</div>
    </div>
  )
}
