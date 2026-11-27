import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { clientStats, currentSession } from '../../api'
import { Button, Card, CardHead, CodeChip, ErrorState, Loading, PageHead, Stat, StatusPill, Table, Td, Tr, useData } from '../../components/ui'
import { docLabel, fullName, pct, reasonText, timeAgo } from '../../lib/format'

export function Dashboard() {
  const nav = useNavigate()
  const s = currentSession('client')!
  const { data, error, loading, reload } = useData(() => clientStats(), [])
  const newOne = <Button variant="primary" onClick={() => nav('/app/verifications/new')}><Plus size={16} /> New verification</Button>
  return (
    <>
      <PageHead title={`Good to see you, ${s.name}`} sub="Here is how identity checks are going for your customers.">{newOne}</PageHead>
      {loading && !data && <Loading />}
      {error && !data && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Verifications" value={data.total} note={`${data.pending} waiting for the applicant`} />
            <Stat label="Verified" value={data.passed} note={`${pct(data.passRate)} pass rate`} tone="ok" />
            <Stat label="Declined" value={data.failed} note={data.topReasons[0] ? `Top: ${data.topReasons[0][0]}` : 'No declines'} tone="bad" />
            <Stat label="Median completion" value={data.avgSeconds ? (data.avgSeconds >= 120 ? `${(data.avgSeconds / 60).toFixed(1)} min` : `${data.avgSeconds.toFixed(0)} s`) : '—'} note="Link opened to decision, last 30 days" />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHead title="Latest verifications">
                <Link to="/app/verifications" className="flex items-center gap-1 text-[12.5px] font-semibold text-brand">View all <ArrowRight size={14} /></Link>
              </CardHead>
              {data.recent.length === 0 ? (
                <div className="flex flex-col items-start gap-2.5 py-2">
                  <p className="text-muted">No verifications yet. Create one and send the link to your customer.</p>
                  <Button onClick={() => nav('/app/verifications/new')}><Plus size={16} /> New verification</Button>
                </div>
              ) : (
                <div className="-mx-4 overflow-x-auto">
                  <Table bare>
                    {data.recent.map(v => (
                      <Tr key={v.id} onClick={() => nav(`/app/verifications/${v.reference}`)}>
                        <Td><b>{fullName(v.applicant)}</b><div className="font-mono text-[12.5px] text-muted">{v.reference}</div></Td>
                        <Td muted>{v.document_type ? docLabel[v.document_type] : '—'}</Td>
                        <Td muted>{timeAgo(v.created_at)}</Td>
                        <Td right><StatusPill status={v.status} /></Td>
                      </Tr>
                    ))}
                  </Table>
                </div>
              )}
            </Card>
            <Card>
              <CardHead title="Why checks were declined" />
              {data.topReasons.length === 0 && <p className="text-muted">Nothing declined yet.</p>}
              <div className="flex flex-col gap-3.5">
                {data.topReasons.map(([code, n]) => (
                  <div key={code}>
                    <div className="flex items-center justify-between text-[12.5px]"><CodeChip tone="bad">{code}</CodeChip><b>{n}</b></div>
                    <div className="mt-1 text-[12.5px] text-muted">{reasonText[code] || code}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
