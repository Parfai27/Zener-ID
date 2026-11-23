import { API_URL } from '../landing/lib/site'
import type { RegisterRequest } from './mock'
import { ApiError, logout as mockLogout } from './mock'
import type { Session } from './types'

const SESSION_KEY = 'zenerid.session.v1'
const TOKEN_KEY = 'zenerid.auth-token.v1'
const TOKEN_EXPIRY_KEY = 'zenerid.auth-token-expiry.v1'

interface AccountResponse {
  id: string
  email: string
  first_name: string
  last_name: string
}

interface TokenResponse {
  access_token: string
  expires_in: number
  account: AccountResponse
}

interface ForgotPasswordResponse {
  reset_token: string | null
}

async function post<T>(path: string, body: object): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL.replace(/\/$/, '')}/v1/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the authentication server. Check that the backend is running.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? payload.detail
      : undefined
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => item && typeof item === 'object' && 'msg' in item ? String(item.msg) : '').filter(Boolean).join(' ')
        : 'The authentication request could not be completed.'
    throw new ApiError(response.status, message)
  }
  return payload as T
}

function saveSession(response: TokenResponse): Session {
  const { account } = response
  const session: Session = {
    role: 'client',
    name: `${account.first_name} ${account.last_name}`.trim(),
    email: account.email,
    client_id: account.id,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem(TOKEN_KEY, response.access_token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + response.expires_in * 1000))
  return session
}

export function currentSession(role: Session['role']): Session | null {
  if (role === 'staff') {
    try {
      const raw = localStorage.getItem('zenerid.staff.v1')
      return raw ? JSON.parse(raw) as Session : null
    } catch {
      return null
    }
  }

  try {
    const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY))
    if (!expiresAt || expiresAt <= Date.now()) {
      logout('client')
      return null
    }
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await post<TokenResponse>('login', { email, password })
  return saveSession(response)
}

export async function register(body: RegisterRequest): Promise<Session> {
  const response = await post<TokenResponse>('register', body)
  return saveSession(response)
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await post<ForgotPasswordResponse>('forgot-password', { email })
  return response.reset_token ?? ''
}

export async function resetPassword(_email: string, code: string, password: string): Promise<void> {
  await post<AccountResponse>('reset-password', { token: code.trim(), password })
  logout('client')
}

export function logout(role: Session['role']) {
  if (role === 'staff') {
    mockLogout(role)
    return
  }
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}
