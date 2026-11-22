'use client'

import { CheckCircle2, Loader2, Mail, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'

import { FormError } from './form-error'

export type Channel = 'email' | 'sms'

/** Send the verification link by email or SMS through the backend. */
export function SendLinkDialog({
  channel,
  reference,
  defaultTo,
  fallbackHref,
  onClose,
}: {
  channel: Channel
  reference: string
  defaultTo: string
  /** A mailto: / sms: link, offered when the server cannot send. */
  fallbackHref: string
  onClose: () => void
}) {
  const [to, setTo] = useState(defaultTo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; notSetUp: boolean } | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const isEmail = channel === 'email'
  const Icon = isEmail ? Mail : MessageSquare

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/zid/verifications/${encodeURIComponent(reference)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, to: to.trim() }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      setError({
        message: body?.detail ?? 'Could not send it. Try again.',
        notSetUp: res?.status === 503,
      })
      return
    }
    setSentTo(body.to)
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <span className="grid size-10 place-items-center rounded-full bg-mint-tint text-evergreen">
            <Icon className="size-5" />
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-4 hover:bg-subtle hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        {sentTo ? (
          <div className="mt-4 space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
              <CheckCircle2 className="size-5 text-ok" /> Sent
            </h2>
            <p className="text-sm text-ink-3">
              The verification link was sent by {isEmail ? 'email' : 'SMS'} to <b className="text-ink">{sentTo}</b>.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="btn-primary">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="mt-4 space-y-4">
            <h2 className="text-xl font-bold text-ink">Send by {isEmail ? 'email' : 'SMS'}</h2>
            <div>
              <label htmlFor="send-to" className="field-label">{isEmail ? 'Email address' : 'Phone number'}</label>
              <input
                id="send-to"
                type={isEmail ? 'email' : 'tel'}
                required
                autoFocus
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={isEmail ? 'name@example.com' : '+250788123456'}
                className="field"
              />
              {!isEmail && <p className="mt-1 text-xs text-ink-3">International format, starting with + and the country code.</p>}
            </div>
            {error && (
              <div className="space-y-2">
                <FormError message={error.message} />
                {error.notSetUp && (
                  <a href={fallbackHref} className="inline-block text-sm font-semibold text-evergreen hover:underline">
                    Open {isEmail ? 'your email app' : 'your messaging app'} instead
                  </a>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : 'Send link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
