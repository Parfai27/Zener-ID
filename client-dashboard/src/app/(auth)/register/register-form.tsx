'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { FormError } from '@/components/form-error'
import { countryOptions } from '@/lib/countries'

export function RegisterForm() {
  const router = useRouter()
  const countries = useMemo(countryOptions, [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password !== f.get('confirm')) {
      setError('The two passwords are different.')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: f.get('first_name'),
        last_name: f.get('last_name'),
        email: f.get('email'),
        password,
        country_code: f.get('country_code'),
        phone: f.get('phone'),
        date_of_birth: f.get('date_of_birth'),
        country: f.get('country'),
      }),
    }).catch(() => null)
    if (!res?.ok) {
      const body = await res?.json().catch(() => null)
      setError(body?.detail ?? 'Could not create the account. Try again.')
      setBusy(false)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="field-label">First name</label>
          <input id="first_name" name="first_name" required maxLength={80} autoComplete="given-name" className="field" />
        </div>
        <div>
          <label htmlFor="last_name" className="field-label">Last name</label>
          <input id="last_name" name="last_name" required maxLength={80} autoComplete="family-name" className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="field-label">Work email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <div>
          <label htmlFor="country_code" className="field-label">Code</label>
          <input id="country_code" name="country_code" required defaultValue="+250" maxLength={8} className="field" />
        </div>
        <div>
          <label htmlFor="phone" className="field-label">Phone</label>
          <input id="phone" name="phone" type="tel" required minLength={5} maxLength={32} autoComplete="tel-national" className="field" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="country" className="field-label">Country</label>
          <select id="country" name="country" required defaultValue="RW" className="field">
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date_of_birth" className="field-label">Date of birth</label>
          <input id="date_of_birth" name="date_of_birth" type="date" required className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="field" />
        <p className="mt-1 text-xs text-ink-3">At least 12 characters. Common passwords are refused.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </div>
      <FormError message={error} />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
