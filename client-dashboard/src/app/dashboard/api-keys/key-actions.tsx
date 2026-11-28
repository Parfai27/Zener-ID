'use client'

import { AlertTriangle, Check, Copy, KeyRound, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { FormError } from '@/components/form-error'
import type { CreatedApiKey } from '@/lib/types'

function Dialog({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

async function detail(res: Response | null, fallback: string) {
  const body = await res?.json().catch(() => null)
  return (body?.detail as string) ?? fallback
}

export function CreateKeyButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  function close() {
    setOpen(false)
    setCreated(null)
    setError(null)
    setCopied(false)
    router.refresh()
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    const res = await fetch('/api/zid/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: String(f.get('name')).trim(), expires_in_days: Number(f.get('days')) }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError(await detail(res, 'Could not create the key.'))
    setCreated(await res.json())
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="size-4" /> Create API key
      </button>
      {open && (
        <Dialog onClose={created ? undefined : close}>
          <span className="grid size-10 place-items-center rounded-full bg-mint-tint text-evergreen">
            <KeyRound className="size-5" />
          </span>
          {!created ? (
            <form onSubmit={create} className="mt-4 space-y-4">
              <h2 className="text-xl font-bold text-ink">Create an API key</h2>
              <div>
                <label htmlFor="key-name" className="field-label">Name</label>
                <input id="key-name" name="name" required maxLength={80} autoFocus placeholder="e.g. Production server" className="field" />
                <p className="mt-1 text-xs text-ink-3">So you can tell keys apart later.</p>
              </div>
              <div>
                <label htmlFor="key-days" className="field-label">Expires after</label>
                <select id="key-days" name="days" defaultValue="90" className="field">
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              <FormError message={error} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create key'}</button>
              </div>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <h2 className="text-xl font-bold text-ink">Copy your new key now</h2>
              <p className="text-sm text-ink-3">This is the only time the full key is shown. Store it in your secrets manager.</p>
              <div className="flex gap-2">
                <input readOnly value={created.key} onFocus={(e) => e.target.select()} aria-label="New API key" className="field font-mono text-xs" />
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(created.key).catch(() => {})
                    setCopied(true)
                  }}
                  className="btn-secondary shrink-0"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="flex items-center gap-2 rounded-lg bg-warn-tint px-3 py-2 text-xs text-warn">
                <AlertTriangle className="size-4 shrink-0" /> You will not be able to see this key again after closing.
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={close} className="btn-primary">I have copied it</button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </>
  )
}

export function KeyActions({ id, name, prefix, revoked }: { id: string; name: string; prefix: string; revoked: boolean }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<'revoke' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setError(null)
    const path = `/api/zid/api-keys/${encodeURIComponent(id)}${confirm === 'revoke' ? '/revoke' : ''}`
    const res = await fetch(path, { method: confirm === 'revoke' ? 'POST' : 'DELETE' }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError(await detail(res, 'That did not work. Try again.'))
    setConfirm(null)
    router.refresh()
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        {!revoked && (
          <button type="button" onClick={() => setConfirm('revoke')} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-bad hover:bg-bad-tint">
            Revoke
          </button>
        )}
        <button type="button" onClick={() => setConfirm('delete')} aria-label={`Delete ${name}`} className="rounded-lg p-1.5 text-ink-4 hover:bg-subtle hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      {confirm && (
        <Dialog onClose={() => setConfirm(null)}>
          <span className="grid size-10 place-items-center rounded-full bg-bad-tint text-bad">
            <AlertTriangle className="size-5" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-ink">
            {confirm === 'revoke' ? 'Revoke' : 'Delete'} “{name}”?
          </h2>
          <p className="mt-2 text-left text-sm whitespace-normal text-ink-3">
            {confirm === 'revoke'
              ? <>Any server using <span className="font-mono">{prefix}…</span> stops working immediately. This cannot be undone.</>
              : <>The key is revoked if it still works and removed from this list. Its activity stays in your logs.</>}
          </p>
          <div className="mt-4">
            <FormError message={error} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={run} disabled={busy} className="btn bg-bad text-white hover:bg-bad/90">
              {busy ? 'Working…' : confirm === 'revoke' ? 'Revoke key' : 'Delete key'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
