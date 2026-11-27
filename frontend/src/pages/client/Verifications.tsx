import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { listVerifications } from '../../api'
import type { VerificationStatus } from '../../api/types'
import { Avatar, Button, Chip, EmptyRow, ErrorState, LoadingRow, PageHead, SearchInput, StatusPill, Table, Td, Tr, useData } from '../../components/ui'
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
      <PageHead title="Verifications" sub="Every identity check for your workspace, newest first.">
        <Button variant="primary" onClick={() => nav('/app/verifications/new')}><Plus size={16} /> New verification</Button>
      </PageHead>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput className="w-full sm:w-[300px]" placeholder="Search name, reference or your ID" value={q} onChange={e => { setQ(e.target.value); set('q', e.target.value) }} />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <Chip key={f} active={status === f} count={data?.counts[f] ?? ''} onClick={() => set('status', f)}>{f === 'all' ? 'All' : statusInfo[f].label}</Chip>
          ))}
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <Table head={['Reference', 'Applicant', 'Document', 'Created', 'Status', '']}>
        {loading && !data && <LoadingRow cols={6} />}
        {data?.rows.length === 0 && <EmptyRow cols={6}>No verifications match. Try another filter or create a new verification.</EmptyRow>}
        {data?.rows.map(v => (
          <Tr key={v.id} onClick={() => nav(`/app/verifications/${v.reference}`)}>
            <Td><span className="font-mono text-[12.5px]">{v.reference}</span>{v.customer_id && <div className="text-[12.5px] text-muted">{v.customer_id}</div>}</Td>
            <Td><div className="flex items-center gap-2.5"><Avatar name={fullName(v.applicant)} /><b>{fullName(v.applicant)}</b></div></Td>
            <Td muted>{v.document_type ? docLabel[v.document_type] : '—'}</Td>
            <Td muted>{timeAgo(v.created_at)}</Td>
            <Td><StatusPill status={v.status} /></Td>
            <Td><ChevronRight size={16} className="text-faint" /></Td>
          </Tr>
        ))}
      </Table>
      {data && <p className="text-[12.5px] text-muted">Showing {data.rows.length} of {data.total}</p>}
    </>
  )
}
