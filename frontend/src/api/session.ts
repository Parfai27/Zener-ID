// Who is signed in, in this browser. The backend's access token is kept here
// with the name and email to show, until it expires.
import type { Session } from './types'

const KEYS: Record<Session['role'], string> = {
  client: 'zenerid.auth.client.v1',
  staff: 'zenerid.auth.staff.v1',
}

export interface StoredSession extends Session {
  token: string
  /** Epoch milliseconds. */
  expires_at: number
}

export function currentSession(role: Session['role']): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEYS[role])
    if (!raw) return null
    const s = JSON.parse(raw) as StoredSession
    if (!s.token || !s.expires_at || s.expires_at <= Date.now()) {
      localStorage.removeItem(KEYS[role])
      return null
    }
    return s
  } catch {
    return null
  }
}

export function saveSession(s: StoredSession) {
  localStorage.setItem(KEYS[s.role], JSON.stringify(s))
}

export function logout(role: Session['role']) {
  try { localStorage.removeItem(KEYS[role]) } catch { /* storage blocked */ }
}
