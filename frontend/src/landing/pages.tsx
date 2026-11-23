// The landing, sign-in and register pages, ported from the Next.js `landing`
// repo (src/app/page.tsx, login/page.tsx, signup/page.tsx).
import { countries as CODES } from 'country-flag-icons'
import { useEffect, useMemo } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { currentSession } from '../api'
import { AuthLayout } from '@/components/auth/auth-layout'
import { FormAlert } from '@/components/auth/fields'
import { SignInForm } from '@/components/auth/sign-in-form'
import { SignUpForm } from '@/components/auth/sign-up-form'
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
  if (!message && !expired && currentSession('client')) return <Navigate to={next ?? DASHBOARD_URL} replace />

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
          <p className="text-[13.5px] text-muted">
            Platform staff?{' '}
            <Link to="/admin/login" className="font-medium text-brand hover:underline">Sign in to the admin console</Link>
          </p>
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
