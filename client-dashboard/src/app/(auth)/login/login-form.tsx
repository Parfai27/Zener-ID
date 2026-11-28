'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { FormError } from '@/components/form-error'

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    }).catch(() => null)
    if (!res?.ok) {
      const body = await res?.json().catch(() => null)
      setError(body?.detail ?? 'Could not sign in. Try again.')
      setBusy(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="field-label">
          Work email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      <FormError message={error} />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
