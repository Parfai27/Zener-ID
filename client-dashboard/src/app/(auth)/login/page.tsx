import type { Metadata } from 'next'
import Link from 'next/link'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { expired, next } = await searchParams
  return (
    <>
      <h2 className="text-3xl font-extrabold text-pine">Sign in</h2>
      <p className="mt-2 text-ink-3">Welcome back. Sign in to your company dashboard.</p>
      {expired && (
        <p className="mt-6 rounded-lg bg-warn-tint px-4 py-3 text-sm text-warn">Your session ended. Sign in again.</p>
      )}
      <LoginForm next={next?.startsWith('/dashboard') ? next : '/dashboard'} />
      <p className="mt-6 text-center text-sm text-ink-3">
        New to Zener ID?{' '}
        <Link href="/register" className="font-semibold text-evergreen hover:underline">
          Create a company account
        </Link>
      </p>
    </>
  )
}
