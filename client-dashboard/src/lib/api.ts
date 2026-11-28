import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { BACKEND_URL, SESSION_COOKIE, errorMessage } from './session'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * GET a backend path (`/v1/...`) as the signed-in company, from a server
 * component. An expired session goes back to sign-in; any other failure throws.
 */
export async function api<T>(path: string, query?: Record<string, string | number | undefined | null>): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) redirect('/login')

  const url = new URL(`${BACKEND_URL}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  } catch {
    throw new ApiError(503, `Cannot reach the Zener ID backend at ${BACKEND_URL}. Is it running?`)
  }

  // The cookie can only be cleared by a route handler, so go through logout.
  if (res.status === 401) redirect('/api/auth/logout?expired=1')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, errorMessage(body, `The backend answered ${res.status}`))
  }
  return (await res.json()) as T
}
