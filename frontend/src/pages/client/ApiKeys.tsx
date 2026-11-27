import { useState } from 'react'
import { AlertTriangle, Copy, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { createApiKey, listApiKeys, revokeApiKey } from '../../api'
import type { ApiKey, CreatedApiKey } from '../../api/types'
import { Avatar, Banner, Button, Card, EmptyRow, ErrorState, ErrorText, Field, Input, LoadingRow, Modal, PageHead, Pill, Select, Spinner, Table, Td, Tr, copyText, useData, useToast, type Tone } from '../../components/ui'
import { dateTime, timeAgo } from '../../lib/format'
import { API } from '../../api/http'

const STATE: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'ok' },
  expiring: { label: 'Expiring soon', tone: 'warn' },
  suspended: { label: 'Suspended', tone: 'bad' },
  expired: { label: 'Expired', tone: 'muted' },
  revoked: { label: 'Revoked', tone: 'muted' },
}
const apiBase = () => `${API || window.location.origin}/v1`

export function ApiKeys() {
  const toast = useToast()
  const { data, error, loading, reload } = useData(() => listApiKeys(), [])
  const [creating, setCreating] = useState(false)
  const [revoke, setRevoke] = useState<ApiKey | null>(null)
  return (
    <>
      <PageHead title="API keys" sub="Use keys to create and read verifications from your own application.">
        <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> Create API key</Button>
      </PageHead>
      <Banner tone="info" icon={<ShieldCheck size={18} />}>A new key is shown <b>once</b>. We store only a hash of it, so it can never be shown again. Revoke a key straight away if it leaks.</Banner>
      {error && <ErrorState message={error} onRetry={reload} />}
      <Table head={['Name', 'Key', 'Created', 'Expires', 'Last used', 'Status', '']}>
        {loading && !data && <LoadingRow cols={7} />}
        {data?.length === 0 && <EmptyRow cols={7}>No keys yet. Create one to call the API from your own servers.</EmptyRow>}
        {data?.map(k => {
          const s = STATE[k.state ?? (k.revoked ? 'revoked' : 'active')] ?? STATE.active
          return (
            <Tr key={k.id}>
              <Td><b>{k.name}</b></Td>
              <Td mono>{k.prefix}••••••••</Td>
              <Td muted>{dateTime(k.created_at)}</Td>
              <Td muted>{dateTime(k.expires_at)}</Td>
              <Td muted>{k.last_used_at ? timeAgo(k.last_used_at) : 'Never'}</Td>
              <Td><Pill tone={s.tone}>{s.label}</Pill></Td>
              <Td right>{!k.revoked && k.state !== 'expired' && <Button variant="ghost" size="sm" className="text-bad" onClick={() => setRevoke(k)}>Revoke</Button>}</Td>
            </Tr>
          )
        })}
      </Table>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-1.5"><span className="text-[12.5px] text-muted">Base URL</span><span className="break-all font-mono text-[12.5px]">{apiBase()}</span><span className="text-[12.5px] text-muted">Send the key in the <span className="font-mono">X-API-Key</span> header.</span></Card>
        <Card className="flex flex-col gap-1.5"><span className="text-[12.5px] text-muted">Documentation</span><b>OpenAPI reference and examples</b><span className="text-[12.5px] text-muted">Served by the backend at /docs.</span></Card>
      </div>
      <CreateKey open={creating} onClose={() => { setCreating(false); reload() }} />
      <Modal open={!!revoke} onClose={() => setRevoke(null)} width={440}>
        <div className="flex flex-col gap-3.5">
          <Avatar lg className="bg-bad-tint text-bad"><AlertTriangle size={20} /></Avatar>
          <h2 className="text-lg">Revoke “{revoke?.name}”?</h2>
          <p className="text-muted">Any server using <span className="font-mono">{revoke?.prefix}…</span> stops working immediately. This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setRevoke(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => {
              try { await revokeApiKey(revoke!.id); toast(`“${revoke!.name}” revoked`) } catch (e) { toast((e as Error).message, 'bad') }
              setRevoke(null); reload()
            }}>Revoke key</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function CreateKey({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [days, setDays] = useState(90)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => { setName(''); setCreated(null); setError(''); onClose() }
  const create = async () => {
    setBusy(true); setError('')
    try { setCreated(await createApiKey(name, days)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={created ? () => {} : close}>
      <div className="flex flex-col gap-4">
        <Avatar lg><KeyRound size={20} /></Avatar>
        {!created ? (
          <>
            <h2 className="text-lg">Create an API key</h2>
            <Field label="Name" hint="So you can tell keys apart later.">
              <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production server" onKeyDown={e => e.key === 'Enter' && create()} />
            </Field>
            <Field label="Expires after" hint="Keys always expire, so old ones do not keep working forever.">
              <Select value={days} onChange={e => setDays(Number(e.target.value))}>{[30, 90, 180, 365].map(d => <option key={d} value={d}>{d} days</option>)}</Select>
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex justify-end gap-3"><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={create} disabled={busy}>{busy ? <Spinner sm /> : 'Create key'}</Button></div>
          </>
        ) : (
          <>
            <h2 className="text-lg">Copy your new key now</h2>
            <p className="text-muted">This is the only time the full key is shown. Store it in your secrets manager.</p>
            <div className="flex gap-2"><Input className="font-mono" readOnly value={created.secret} onFocus={e => e.target.select()} /><Button onClick={() => { copyText(created.secret); toast('Key copied') }}><Copy size={16} /> Copy</Button></div>
            <Banner tone="warn" icon={<AlertTriangle size={16} />}>You will not be able to see this key again after closing.</Banner>
            <div className="flex justify-end"><Button variant="primary" onClick={close}>I have copied it</Button></div>
          </>
        )}
      </div>
    </Modal>
  )
}
