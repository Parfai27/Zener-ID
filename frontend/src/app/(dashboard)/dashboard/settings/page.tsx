import type { Metadata } from 'next'

import { Field, PageHeader } from '@/components/ui'
import { api } from '@/lib/api'
import { countryName } from '@/lib/countries'
import { dateOnly, dateTime } from '@/lib/format'
import type { Account } from '@/lib/types'

import { CallbackSecret } from './callback-secret'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const me = await api<Account>('/v1/auth/me')

  return (
    <>
      <PageHeader title="Settings" description="Your account and how your systems hear about decisions." />

      <div className="grid max-w-4xl gap-6">
        <section className="card p-6">
          <h2 className="text-lg font-bold text-ink">Account</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-3">
            <Field label="Account holder">{`${me.first_name} ${me.last_name}`}</Field>
            <Field label="Email">{me.email}</Field>
            <Field label="Phone">{`${me.country_code} ${me.phone}`}</Field>
            <Field label="Country">{countryName(me.country)}</Field>
            <Field label="Date of birth">{dateOnly(me.date_of_birth)}</Field>
            <Field label="Member since">{dateTime(me.created_at)}</Field>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-bold text-ink">Decision callbacks</h2>
          <p className="mt-1 text-sm text-ink-3">
            When you open a verification through the API with a <span className="font-mono">callback_url</span>, the
            decision is POSTed there (events <span className="font-mono">verification.accepted</span>,{' '}
            <span className="font-mono">verification.declined</span>, <span className="font-mono">verification.review</span>
            ). Each request is signed so you can check it came from Zener ID.
          </p>
          <CallbackSecret />
        </section>
      </div>
    </>
  )
}
