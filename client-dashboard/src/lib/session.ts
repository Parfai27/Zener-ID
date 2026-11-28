// Where the backend lives and how the dashboard remembers who is signed in.
//
// The backend's access token is kept in an httpOnly cookie, so page scripts
// never see it. Server components and the /api/zid proxy read it and pass it
// on to the backend as a bearer token.

export const SESSION_COOKIE = 'zid_session'

export const BACKEND_URL = (process.env.ZENER_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
})

/** The backend's error message out of a FastAPI error body. */
export function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    // Validation errors: a list of {loc, msg}.
    if (Array.isArray(detail) && detail.length) {
      return detail
        .map((d) => {
          const field = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== 'body').join('.') : ''
          const msg = String(d?.msg ?? '').replace(/^Value error, /, '')
          return field ? `${field}: ${msg}` : msg
        })
        .join('; ')
    }
  }
  return fallback
}
