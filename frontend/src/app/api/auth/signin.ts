import { NextResponse } from 'next/server'

import { BACKEND_URL, SESSION_COOKIE, cookieOptions, errorMessage } from '@/lib/session'
import type { TokenResponse } from '@/lib/types'

/**
 * Pass a sign-in or registration on to the backend. On success the access token
 * goes into an httpOnly cookie and only the account comes back to the browser.
 */
export async function signIn(request: Request, path: string, fallback: string) {
  const body = await request.text()
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ detail: 'Cannot reach the Zener ID backend. Is it running?' }, { status: 503 })
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return NextResponse.json({ detail: errorMessage(data, fallback) }, { status: res.status })
  }

  const token = data as TokenResponse
  const response = NextResponse.json({ account: token.account })
  response.cookies.set(SESSION_COOKIE, token.access_token, cookieOptions(token.expires_in))
  return response
}
