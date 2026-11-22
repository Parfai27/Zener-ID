// The landing, sign-in and register pages, ported from the Next.js `landing`
// repo (src/app/page.tsx, login/page.tsx, signup/page.tsx). Server-only parts
// (session cookie, redirect) are replaced by the token kept in this browser (src/api/session.ts).
import { countries as CODES } from 'country-flag-icons'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { ApiError, currentSession, resetPassword } from '../api'
import { AuthLayout } from '@/components/auth/auth-layout'
import { Field, FormAlert, PasswordInput, SubmitButton } from '@/components/auth/fields'
import { SignInForm } from '@/components/auth/sign-in-form'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { BackToTop } from '@/components/back-to-top'
import { Benefits } from '@/components/benefits'
import { Checks } from '@/components/checks'
import { Faq, QUESTIONS } from '@/components/faq'
import { ClosingCta, Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { HowItWorks } from '@/components/how-it-works'
import { Industries } from '@/components/industries'
import { Platform } from '@/components/platform'
import { Security } from '@/components/security'
import { authError, safeNext } from '@/lib/auth-errors'
import { CONTACT_EMAIL, DASHBOARD_URL, PRODUCT, SIGN_IN_HREF, SIGN_UP_HREF, SITE } from '@/lib/site'

function useTitle(title: string) {
  useEffect(() => { document.title = title }, [title])
}

/** Structured data so search engines can show the product and the FAQ as rich results. */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#organization`, name: PRODUCT, url: SITE, email: CONTACT_EMAIL },
    {
      '@type': 'SoftwareApplication',
      name: PRODUCT,
      url: SITE,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Identity verification and AML screening: ID documents, liveness, deepfake checks, proof of address and sanctions screening in one flow.',
      provider: { '@id': `${SITE}/#organization` },
    },
    {
      '@type': 'FAQPage',
      mainEntity: QUESTIONS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ],
}

export function LandingPage() {
  useTitle('Zener ID: identity verification and AML screening')
  return (
    <div className="lp overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
      <Header />
      <main>
        <Hero />
        <Benefits />
        <Checks />
        <HowItWorks />
        <Platform />
        <Industries />
        <Security />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}

export function SignInPage() {
  useTitle('Log in | Zener ID')
  const [params] = useSearchParams()
  const next = safeNext(params.get('next') ?? undefined)
  const message = authError(params.get('error') ?? undefined, params.get('fields') ?? undefined)
  const expired = params.has('expired')
  // Already signed in: straight on to the dashboard.
  if (!message && !expired && currentSession('staff')) return <Navigate to={next?.startsWith('/admin') ? next : '/admin'} replace />
  if (!message && !expired && currentSession('client')) return <Navigate to={next && !next.startsWith('/admin') ? next : DASHBOARD_URL} replace />

  return (
    <div className="lp">
      <AuthLayout
        switcher={<>New to Zener ID?{' '}<Link to={SIGN_UP_HREF} className="font-medium text-brand hover:underline">Create an account</Link></>}
      >
        <h1 className="text-[32px] leading-tight font-bold text-ink">Log in</h1>
        <p className="mt-2 text-[15.5px] text-muted">Log in to your Zener ID dashboard.</p>
        <div className="mt-8 flex flex-col gap-5">
          {message ? <FormAlert>{message}</FormAlert> : null}
          {!message && expired ? <FormAlert tone="note">Your session has ended. Log in again to carry on.</FormAlert> : null}
          <SignInForm next={next} />
        </div>
      </AuthLayout>
    </div>
  )
}

/** Every ISO country, by its English name. */
function countryOptions() {
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  return CODES.filter(code => /^[A-Z]{2}$/.test(code))
    .map(code => ({ code, name: names.of(code) ?? code }))
    .filter(country => country.name !== country.code)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

export function SignUpPage() {
  useTitle('Create an account | Zener ID')
  const [params] = useSearchParams()
  const message = authError(params.get('error') ?? undefined, params.get('fields') ?? undefined)
  const countries = useMemo(countryOptions, [])
  if (!message && currentSession('client')) return <Navigate to={DASHBOARD_URL} replace />

  return (
    <div className="lp">
      <AuthLayout
        switcher={<>Already have an account?{' '}<Link to={SIGN_IN_HREF} className="font-medium text-brand hover:underline">Log in</Link></>}
      >
        <h1 className="text-[32px] leading-tight font-bold text-ink">Create your account</h1>
        <p className="mt-2 text-[15.5px] text-muted">Your dashboard is ready as soon as you sign up.</p>
        <div className="mt-6 flex flex-col gap-5">
          {message ? <FormAlert>{message}</FormAlert> : null}
          <SignUpForm countries={countries} />
        </div>
      </AuthLayout>
    </div>
  )
}

/** Where the reset email's link lands: /reset-password?token=... */
export function ResetPasswordPage() {
  useTitle('Set a new password | Zener ID')
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [error, setError] = useState<string>()
  const [alert, setAlert] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    setAlert(undefined)
    if (password.length < 12) return setError('Use at least 12 characters.')
    if (password !== String(data.get('confirm') ?? '')) return setError('The two passwords are different.')
    setError(undefined)
    setBusy(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (e) {
      const fields = e instanceof ApiError ? e.fields : undefined
      if (fields?.password) setError(fields.password)
      else setAlert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lp">
      <AuthLayout switcher={<>Remembered it?{' '}<Link to={SIGN_IN_HREF} className="font-medium text-brand hover:underline">Log in</Link></>}>
        <h1 className="text-[32px] leading-tight font-bold text-ink">Set a new password</h1>
        {done ? (
          <div className="mt-6 flex flex-col gap-5">
            <FormAlert tone="note">Your password has been changed. Log in with the new one.</FormAlert>
            <Link to={SIGN_IN_HREF} className="inline-flex h-12 items-center justify-center rounded-[10px] bg-brand-deep px-6 text-[15px] font-semibold text-white hover:bg-brand">Log in</Link>
          </div>
        ) : !token ? (
          <div className="mt-6"><FormAlert>This link is missing its code. Ask for a new reset link from the log in page.</FormAlert></div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            {alert ? <FormAlert>{alert}</FormAlert> : null}
            <Field id="password" label="New password" error={error}>
              <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!error} />
              {error ? null : <p className="text-[13px] text-muted">At least 12 characters.</p>}
            </Field>
            <Field id="confirm" label="Same password again">
              <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
            </Field>
            <SubmitButton busy={busy}>{busy ? 'Saving' : 'Save new password'}</SubmitButton>
          </form>
        )}
      </AuthLayout>
    </div>
  )
}
