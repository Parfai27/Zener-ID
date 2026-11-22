'use client'

import { Check, Copy, Eye } from 'lucide-react'
import { useState } from 'react'

import { FormError } from '@/components/form-error'

interface Secret {
  secret: string
  signature_header: string
  timestamp_header: string
  signed: string
  algorithm: string
}

/** The signing key is fetched only when asked for, so it is not sitting in the page. */
export function CallbackSecret() {
  const [secret, setSecret] = useState<Secret | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function reveal() {
    setError(null)
    const res = await fetch('/api/zid/auth/callback-secret').catch(() => null)
    if (!res?.ok) return setError('Could not load the signing key.')
    setSecret(await res.json())
  }

  if (!secret) {
    return (
      <div className="mt-5 space-y-3">
        <button type="button" onClick={reveal} className="btn-secondary">
          <Eye className="size-4" /> Show signing key
        </button>
        <FormError message={error} />
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex gap-2">
        <input readOnly value={secret.secret} aria-label="Signing key" onFocus={(e) => e.target.select()} className="field font-mono text-xs" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(secret.secret).catch(() => {})
            setCopied(true)
          }}
          className="btn-secondary shrink-0"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <dl className="grid gap-3 rounded-lg bg-paper p-4 text-xs text-ink-2 sm:grid-cols-2">
        <div>
          <dt className="text-ink-4">Signature header</dt>
          <dd className="font-mono">{secret.signature_header}</dd>
        </div>
        <div>
          <dt className="text-ink-4">Timestamp header</dt>
          <dd className="font-mono">{secret.timestamp_header}</dd>
        </div>
        <div>
          <dt className="text-ink-4">What is signed</dt>
          <dd className="font-mono">{secret.signed}</dd>
        </div>
        <div>
          <dt className="text-ink-4">Algorithm</dt>
          <dd className="font-mono">{secret.algorithm}</dd>
        </div>
      </dl>
    </div>
  )
}
