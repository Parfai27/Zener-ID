'use client'

import { CreditCard, IdCard, Loader2, Plane } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { FormError } from '@/components/form-error'
import { countryOptions } from '@/lib/countries'
import type { DocumentType } from '@/lib/types'

const DOCUMENTS: { value: DocumentType; label: string; icon: typeof IdCard }[] = [
  { value: 'id_card', label: 'National ID', icon: IdCard },
  { value: 'passport', label: 'Passport', icon: Plane },
  { value: 'driving_license', label: 'Driving licence', icon: CreditCard },
]

const VALIDITY = [
  { days: 1, label: '24 hours' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

export function NewVerificationForm() {
  const router = useRouter()
  const countries = useMemo(countryOptions, [])
  const [documents, setDocuments] = useState<DocumentType[]>(DOCUMENTS.map((d) => d.value))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  function toggle(doc: DocumentType) {
    setDocuments((current) => (current.includes(doc) ? current.filter((d) => d !== doc) : [...current, doc]))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (documents.length === 0) {
      setError('Choose at least one document the customer may use.')
      return
    }
    const f = new FormData(e.currentTarget)
    const text = (name: string) => String(f.get(name) ?? '').trim() || undefined
    const reference = text('reference')

    setBusy(true)
    setError(null)
    const res = await fetch('/api/zid/verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(reference ? { reference } : {}),
        // AML is added by the backend when the company's plan includes it.
        services: ['document', 'face'],
        applicant: {
          first_name: text('first_name'),
          last_name: text('last_name'),
          date_of_birth: text('date_of_birth'),
          email: text('email'),
          phone: text('phone'),
          country: text('country'),
        },
        document_types: documents,
        ttl_days: Number(f.get('ttl_days')),
      }),
    }).catch(() => null)

    const body = await res?.json().catch(() => null)
    if (!res?.ok) {
      setError(body?.detail ?? 'Could not create the verification. Try again.')
      setBusy(false)
      return
    }
    router.push(`/dashboard/verifications/${encodeURIComponent(body.reference)}/link?created=1`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="card p-6">
        <h2 className="text-lg font-bold text-ink">Customer details</h2>
        <p className="mt-1 text-sm text-ink-3">
          We compare these with what is read from their document, so enter them as they appear on it.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className="field-label">First name *</label>
            <input id="first_name" name="first_name" required maxLength={80} className="field" />
          </div>
          <div>
            <label htmlFor="last_name" className="field-label">Last name *</label>
            <input id="last_name" name="last_name" required maxLength={80} className="field" />
          </div>
          <div>
            <label htmlFor="date_of_birth" className="field-label">Date of birth *</label>
            <input id="date_of_birth" name="date_of_birth" type="date" required max={today} className="field" />
          </div>
          <div>
            <label htmlFor="country" className="field-label">Country *</label>
            <select id="country" name="country" required defaultValue="" className="field">
              <option value="" disabled>
                Choose a country
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email address *</label>
            <input id="email" name="email" type="email" required className="field" placeholder="name@example.com" />
          </div>
          <div>
            <label htmlFor="phone" className="field-label">Phone number *</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              minLength={5}
              maxLength={32}
              className="field"
              placeholder="+250 788 123 456"
            />
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="card p-6">
          <h2 className="text-base font-bold text-ink">Accepted documents</h2>
          <p className="mt-1 text-xs text-ink-3">The customer chooses one of these.</p>
          <div className="mt-4 space-y-2">
            {DOCUMENTS.map(({ value, label, icon: Icon }) => {
              const on = documents.includes(value)
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                    on ? 'border-evergreen bg-mint-tint/60 text-ink' : 'border-line text-ink-3'
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(value)} className="accent-evergreen" />
                  <Icon className="size-4" />
                  {label}
                </label>
              )
            })}
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <div>
            <label htmlFor="ttl_days" className="field-label">Link valid for</label>
            <select id="ttl_days" name="ttl_days" defaultValue="7" className="field">
              {VALIDITY.map((v) => (
                <option key={v.days} value={v.days}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reference" className="field-label">Your reference (optional)</label>
            <input
              id="reference"
              name="reference"
              minLength={6}
              maxLength={250}
              className="field"
              placeholder="e.g. customer ID"
            />
            <p className="mt-1 text-xs text-ink-3">At least 6 characters. Left empty, one is made for you.</p>
          </div>
        </section>

        <FormError message={error} />
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            'Create verification link'
          )}
        </button>
      </aside>
    </form>
  )
}
