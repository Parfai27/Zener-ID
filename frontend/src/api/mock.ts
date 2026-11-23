// In-browser mock of the part of the Zener ID backend not connected yet: the
// admin console's data (overview, review queue, verifications, clients). It
// starts empty and nothing fills it any more: the dashboard and the applicant
// flow use the backend. It goes when the admin console is connected.

import type { ApiKey, Client, Verification, VerificationStatus } from './types'
import { ApiError } from './errors'
import { currentSession } from './session'

// v2: the store starts empty. Bumping the key drops the old sample data.
const KEY = 'zenerid.mock.v2'
for (const old of ['zenerid.mock.v1', 'zenerid.session.v1', 'zenerid.staff.v1', 'zenerid.session.v2', 'zenerid.staff.v2']) {
  try { localStorage.removeItem(old) } catch { /* storage blocked */ }
}

export const FACE_THRESHOLD = 0.45
export const REVIEW_BAND = 0.4

interface Db {
  clients: Client[]
  verifications: Verification[]
  apiKeys: Record<string, ApiKey[]>
  documentAttempts: Record<string, number>
}

// ---------------------------------------------------------------- utilities
const wait = (ms = 350 + Math.random() * 300) => new Promise(r => setTimeout(r, ms))
const iso = (d: Date) => d.toISOString()
const daysAgo = (d: number, h = 0, m = 0) => new Date(Date.now() - ((d * 24 + h) * 60 + m) * 60000)

const listeners = new Set<() => void>()
export function subscribe(fn: () => void) {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) fn() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage) }
}

// ---------------------------------------------------------------- storage
let cache: Db | null = null
function load(): Db {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return (cache = { ...empty(), ...(JSON.parse(raw) as Partial<Db>) })
  } catch { /* fall through to an empty store */ }
  cache = empty()
  save(cache)
  return cache
}
function save(db: Db) {
  cache = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Quota: drop captured images from the oldest records, keep the data.
    for (const v of db.verifications.slice().reverse()) v.evidence.forEach(f => { if (f.url?.startsWith('data:image/jpeg')) f.url = undefined })
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* give up silently */ }
  }
  listeners.forEach(l => l())
}

/** Deletes the verifications and API keys kept in this browser. Accounts live in the backend. */
export function clearAllData() {
  cache = empty()
  save(cache)
}

// ---------------------------------------------------------------- helpers
export function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------- empty store
// No sample data: a client appears when a registered account first opens the dashboard.
function empty(): Db {
  return { clients: [], verifications: [], apiKeys: {}, documentAttempts: {} }
}


// ---------------------------------------------------------------- shared
function refreshExpiry(v: Verification) {
  if ((v.status === 'pending' || v.status === 'in_progress') && new Date(v.expires_at) < new Date()) v.status = 'expired'
}

/** One verification for the admin console (still on this mock). */
export async function getStaffVerification(reference: string): Promise<Verification> {
  await wait(250)
  const db = staff()
  const v = db.verifications.find(x => x.reference === reference)
  if (!v) throw new ApiError(404, 'Verification not found.')
  refreshExpiry(v)
  return v
}

// ---------------------------------------------------------------- staff (admin) API
function staff() {
  if (!currentSession('staff')) throw new ApiError(401, 'Not signed in.')
  return load()
}

export async function adminOverview() {
  await wait(300)
  const db = staff()
  const all = db.verifications
  const done = all.filter(v => ['passed', 'failed', 'needs_review'].includes(v.status))
  const reasons: Record<string, number> = {}
  all.filter(v => v.status === 'failed').forEach(v => v.reasons.forEach(r => (reasons[r] = (reasons[r] || 0) + 1)))
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA')
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = daysAgo(13 - i)
    const that = done.filter(v => dayKey(new Date(v.completed_at || v.created_at)) === dayKey(day))
    return {
      label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      passed: that.filter(v => v.status === 'passed').length,
      review: that.filter(v => v.status === 'needs_review').length,
      failed: that.filter(v => v.status === 'failed').length,
    }
  })
  const secs = done.map(v => v.decision_seconds || 0).filter(Boolean).sort((a, b) => a - b)
  const median = secs.length ? (secs.length % 2 ? secs[(secs.length - 1) / 2] : (secs[secs.length / 2 - 1] + secs[secs.length / 2]) / 2) : 0
  return {
    today: all.filter(v => dayKey(new Date(v.created_at)) === dayKey(new Date())).length,
    passRate: done.length ? done.filter(v => v.status === 'passed').length / done.length : 0,
    medianSeconds: median,
    queue: all.filter(v => v.status === 'needs_review').length,
    days,
    topReasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 6),
    oldest: all.filter(v => v.status === 'needs_review').slice().sort((a, b) => +new Date(a.completed_at!) - +new Date(b.completed_at!)).slice(0, 3),
  }
}

export async function adminVerifications(opts: { status?: VerificationStatus | 'all'; q?: string; client?: string } = {}) {
  await wait(250)
  const db = staff()
  let rows = db.verifications.slice()
  rows.forEach(refreshExpiry)
  if (opts.status && opts.status !== 'all') rows = rows.filter(v => v.status === opts.status)
  if (opts.client) rows = rows.filter(v => v.client_id === opts.client)
  if (opts.q) {
    const q = opts.q.toLowerCase()
    rows = rows.filter(v => `${v.reference} ${v.applicant.first_name} ${v.applicant.last_name} ${v.client_name}`.toLowerCase().includes(q))
  }
  return rows
}

export async function reviewQueue() {
  await wait(250)
  const db = staff()
  return db.verifications.filter(v => v.status === 'needs_review').sort((a, b) => +new Date(a.completed_at!) - +new Date(b.completed_at!))
}

export async function decide(reference: string, action: 'approved' | 'declined' | 'redo', note: string) {
  await wait(500)
  const db = staff()
  if (note.trim().length < 10) throw new ApiError(422, 'Write a note of at least 10 characters explaining the decision.')
  const v = db.verifications.find(x => x.reference === reference)
  if (!v) throw new ApiError(404, 'Verification not found.')
  if (v.status !== 'needs_review') throw new ApiError(409, 'This case was already decided.')
  v.reviews.push({ at: iso(new Date()), by: currentSession('staff')!.name, action, note: note.trim() })
  if (action === 'approved') v.status = 'passed'
  else if (action === 'declined') v.status = 'failed'
  else {
    v.status = 'in_progress'
    v.checks = []
    v.reasons = []
    v.evidence = v.evidence.filter(e => e.kind.startsWith('document'))
  }
  save(db)
  return v
}

export async function listClients() {
  await wait(250)
  const db = staff()
  return db.clients.map(c => {
    const rows = db.verifications.filter(v => v.client_id === c.id)
    const done = rows.filter(v => ['passed', 'failed', 'needs_review'].includes(v.status))
    return { ...c, verifications: rows.length, passRate: done.length ? rows.filter(v => v.status === 'passed').length / done.length : 0, keys: (db.apiKeys[c.id] || []).filter(k => !k.revoked).length }
  })
}

export async function setClientStatus(id: string, status: Client['status']) {
  await wait(300)
  const db = staff()
  const c = db.clients.find(x => x.id === id)
  if (c) c.status = status
  save(db)
}
