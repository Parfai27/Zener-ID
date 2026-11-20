import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { listVerifications } from '../../api'
import type { VerificationStatus } from '../../api/types'
import { Avatar, ErrorState, Loading, StatusPill, useData } from '../../components/ui'
import { docLabel, fullName, statusInfo, timeAgo } from '../../lib/format'

const FILTERS: Array<VerificationStatus | 'all'> = ['all', 'passed', 'failed', 'needs_review', 'in_progress', 'pending', 'expired']

export function Verifications() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as VerificationStatus | 'all') || 'all'
  const [q, setQ] = useState(params.get('q') || '')
  const { data, error, loading, reload } = useData(() => listVerifications({ status, q }), [status, q])
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v && v !== 'all') p.set(k, v); else p.delete(k); setParams(p, { replace: true }) }

  return (
    <>
      <div className="page-head">
        <div><h1>Verifications</h1><p>Every identity check for your workspace, newest first.</p></div>
        <button className="btn btn-primary" onClick={() => nav('/app/verifications/new')}><Plus size={16} /> New verification</button>
      </div>
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="input-icon" style={{ width: 300 }}>
          <Search size={16} />
          <input className="input" placeholder="Search name, reference or your ID" value={q} onChange={e => { setQ(e.target.value); set('q', e.target.value) }} />
        </div>
        <div className="chips">
          {FILTERS.map(f => (
            <button key={f} className={`chip${status === f ? ' active' : ''}`} onClick={() => set('status', f)}>
              {f === 'all' ? 'All' : statusInfo[f].label} <span className="n">{data?.counts[f] ?? ''}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Reference</th><th>Applicant</th><th>Document</th><th>Created</th><th>Status</th><th style={{ width: 30 }} /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={6}><Loading /></td></tr>}
            {data?.rows.length === 0 && <tr><td colSpan={6} className="empty">No verifications match. Try another filter or create a new verification.</td></tr>}
            {data?.rows.map(v => (
              <tr key={v.id} className="clickable" onClick={() => nav(`/app/verifications/${v.reference}`)}>
                <td><span className="mono">{v.reference}</span>{v.customer_id && <div className="small muted">{v.customer_id}</div>}</td>
                <td><div className="row" style={{ gap: 10 }}><Avatar name={fullName(v.applicant)} /><b>{fullName(v.applicant)}</b></div></td>
                <td className="muted">{v.document_type ? docLabel[v.document_type] : '—'}</td>
                <td className="muted">{timeAgo(v.created_at)}</td>
                <td><StatusPill status={v.status} /></td>
                <td><ChevronRight size={16} color="var(--ink-4)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <p className="small muted">Showing {data.rows.length} of {data.counts.all}</p>}
    </>
  )
}
