import { useState } from 'react'
import { AlertTriangle, Copy, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { createApiKey, listApiKeys, revokeApiKey } from '../../api'
import type { ApiKey, CreatedApiKey } from '../../api/types'
import { ErrorState, Loading, Modal, Pill, Spinner, copyText, useData, useToast } from '../../components/ui'
import { dateTime, timeAgo } from '../../lib/format'

export function ApiKeys() {
  const toast = useToast()
  const { data, error, loading, reload } = useData(() => listApiKeys(), [])
  const [creating, setCreating] = useState(false)
  const [revoke, setRevoke] = useState<ApiKey | null>(null)
  return (
    <>
      <div className="page-head">
        <div><h1>API keys</h1><p>Use keys to create and read verifications from your own application.</p></div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Create API key</button>
      </div>
      <div className="banner info"><ShieldCheck size={18} /><div>A new key is shown <b style={{ display: 'inline' }}>once</b>. We store only a hash of it, so it can never be shown again. Revoke a key straight away if it leaks.</div></div>
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th>Status</th><th /></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan={6}><Loading /></td></tr>}
            {data?.length === 0 && <tr><td colSpan={6} className="empty">No keys yet.</td></tr>}
            {data?.map(k => (
              <tr key={k.id}>
                <td><b>{k.name}</b></td>
                <td><span className="mono">{k.prefix}••••••••</span></td>
                <td className="muted">{dateTime(k.created_at)}</td>
                <td className="muted">{k.last_used_at ? timeAgo(k.last_used_at) : 'Never'}</td>
                <td>{k.revoked ? <Pill tone="muted">Revoked</Pill> : <Pill tone="ok">Active</Pill>}</td>
                <td style={{ textAlign: 'right' }}>{!k.revoked && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={() => setRevoke(k)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid g2">
        <div className="card col" style={{ gap: 6 }}><span className="small muted">Base URL</span><span className="mono">https://api.zenerid.com/v1</span><span className="small muted">Send the key as <span className="mono">Authorization: Bearer &lt;key&gt;</span>.</span></div>
        <div className="card col" style={{ gap: 6 }}><span className="small muted">Documentation</span><b>OpenAPI reference and examples</b><span className="small muted">Served by the backend at /docs.</span></div>
      </div>
      <CreateKey open={creating} onClose={() => setCreating(false)} />
      <Modal open={!!revoke} onClose={() => setRevoke(null)} width={440}>
        <div className="col" style={{ gap: 14 }}>
          <span className="avatar lg" style={{ background: 'var(--bad-tint)', color: 'var(--bad)' }}><AlertTriangle size={20} /></span>
          <h3 style={{ fontSize: 20 }}>Revoke “{revoke?.name}”?</h3>
          <p className="muted">Any server using <span className="mono">{revoke?.prefix}…</span> stops working immediately. This cannot be undone.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setRevoke(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={async () => { await revokeApiKey(revoke!.id); toast(`“${revoke!.name}” revoked`); setRevoke(null) }}>Revoke key</button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function CreateKey({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => { setName(''); setCreated(null); setError(''); onClose() }
  const create = async () => {
    setBusy(true); setError('')
    try { setCreated(await createApiKey(name)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={created ? () => {} : close}>
      <div className="col" style={{ gap: 16 }}>
        <span className="avatar lg"><KeyRound size={20} /></span>
        {!created ? (
          <>
            <h3 style={{ fontSize: 20 }}>Create an API key</h3>
            <div className="field"><label>Name</label><input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production server" onKeyDown={e => e.key === 'Enter' && create()} /><span className="hint">So you can tell keys apart later.</span></div>
            {error && <div className="error-text">{error}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? <Spinner sm /> : 'Create key'}</button></div>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 20 }}>Copy your new key now</h3>
            <p className="muted">This is the only time the full key is shown. Store it in your secrets manager.</p>
            <div className="row"><input className="input mono grow" readOnly value={created.secret} onFocus={e => e.target.select()} /><button className="btn btn-secondary" onClick={() => { copyText(created.secret); toast('Key copied') }}><Copy size={16} /> Copy</button></div>
            <div className="banner warn"><AlertTriangle size={16} /><div>You will not be able to see this key again after closing.</div></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={close}>I have copied it</button></div>
          </>
        )}
      </div>
    </Modal>
  )
}
