// Sign-in, registration and password reset, against the backend.
//   client accounts: POST /v1/auth/register | login | forgot-password | reset-password, GET /v1/auth/me
//   staff (admin console): POST /v1/console/auth/login, GET /v1/console/auth/me
import { ApiError } from './errors'
import { request } from './http'
import { currentSession, logout, saveSession, type StoredSession } from './session'
import type { Session } from './types'

// ---------------------------------------------------------------- shapes (app/schemas/auth.py, console.py)
export interface Account {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  country_code: string
  date_of_birth: string
  country: string
  is_active: boolean
  created_at: string
  /** Set for platform staff. */
  console_role?: string | null
}

interface TokenResponse { access_token: string; token_type: string; expires_in: number; account: Account }

interface ConsoleUser { id: string; email: string; first_name: string; last_name: string; role: string; products: string[] }
interface ConsoleTokenResponse { access_token: string; token_type: string; expires_in: number; user: ConsoleUser }

/** Same body as the backend's POST /v1/auth/register (RegisterRequest). */
export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  password: string
  country: string
  country_code: string
  phone: string
  date_of_birth: string
}

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim()

function signedIn(t: TokenResponse): StoredSession {
  const s: StoredSession = {
    role: 'client',
    name: fullName(t.account),
    email: t.account.email,
    // The parts of the dashboard not connected yet keep their data under this id.
    client_id: `acc_${t.account.id}`,
    token: t.access_token,
    expires_at: Date.now() + t.expires_in * 1000,
  }
  saveSession(s)
  return s
}

// ---------------------------------------------------------------- client accounts
/**
 * One sign-in page for everyone. Platform staff (an account with a console role)
 * are signed in to the admin console instead of the client dashboard.
 */
export async function login(email: string, password: string): Promise<Session> {
  const t = await request<TokenResponse>('/auth/login', { body: { email, password } })
  if (t.account.console_role) {
    logout('client')
    return staffLogin(email, password)
  }
  return signedIn(t)
}

/** Opens the account and signs it in at once. */
export async function register(body: RegisterRequest): Promise<Session> {
  return signedIn(await request<TokenResponse>('/auth/register', { body }))
}

/**
 * Asks for a reset link. The answer is the same whether or not the address has an
 * account. On a developer's machine with email off, the backend also returns the
 * token, so the link can be followed without an inbox.
 */
export async function forgotPassword(email: string): Promise<{ message: string; reset_token?: string | null }> {
  return request('/auth/forgot-password', { body: { email } })
}

export async function resetPassword(token: string, password: string): Promise<Account> {
  return request('/auth/reset-password', { body: { token, password } })
}

// ---------------------------------------------------------------- staff
export async function staffLogin(email: string, password: string): Promise<Session> {
  const t = await request<ConsoleTokenResponse>('/console/auth/login', { body: { email, password } })
  const s: StoredSession = {
    role: 'staff',
    name: fullName(t.user) || t.user.email,
    email: t.user.email,
    staff_role: t.user.role,
    token: t.access_token,
    expires_at: Date.now() + t.expires_in * 1000,
  }
  saveSession(s)
  return s
}

/**
 * Asks the backend whether the stored token still works. Signs out and returns
 * false when it does not (expired, revoked, account suspended). A network failure
 * keeps the session: being offline is not being signed out.
 */
export async function verifySession(role: Session['role']): Promise<boolean> {
  const s = currentSession(role)
  if (!s) return false
  try {
    await request(role === 'client' ? '/auth/me' : '/console/auth/me', { token: s.token })
    return true
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      logout(role)
      return false
    }
    return true
  }
}
