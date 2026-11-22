import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <>
      <h2 className="text-3xl font-extrabold text-pine">Create a company account</h2>
      <p className="mt-2 text-ink-3">The account holder&apos;s details. You can start verifying customers right after.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-ink-3">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-evergreen hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
