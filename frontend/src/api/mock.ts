// In-browser mock of the Zener ID backend. Everything lives in localStorage so
// a verification created in the dashboard can be completed in another tab and
// then shows up in the dashboard and the admin review queue.
//
// Each function is async with a small delay, matching how the real HTTP client
// will behave, so loading states can be checked now.

import { documentArt, faceArt } from '../lib/art'
import type {
  ApiKey, Applicant, Check, CheckName, Client, CreateVerificationRequest, CreatedApiKey,
  DocumentStepResult, DocumentType, EvidenceFile, QualityReport, SandboxOutcome, Session,
  SessionView, Verification, VerificationStatus,
} from './types'

const KEY = 'zenerid.mock.v1'
const SESSION_KEY = 'zenerid.session.v1'
const STAFF_SESSION_KEY = 'zenerid.staff.v1'
const RESET_CODES_KEY = 'zenerid.reset-codes.v1'

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
const rid = (n: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') =>
  Array.from(crypto.getRandomValues(new Uint32Array(n)), x => alphabet[x % alphabet.length]).join('')
const token = () => rid(22, 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_')
const iso = (d: Date) => d.toISOString()
const daysAgo = (d: number, h = 0, m = 0) => new Date(Date.now() - ((d * 24 + h) * 60 + m) * 60000)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const upper = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

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
    if (raw) return (cache = JSON.parse(raw) as Db)
  } catch { /* fall through to seed */ }
  cache = seed()
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

export function resetMockData() {
  cache = seed()
  save(cache)
}

// ---------------------------------------------------------------- decision engine
const docLabel: Record<DocumentType, string> = { passport: 'Passport', id_card: 'National ID card', driving_license: 'Driving licence' }

function buildOutcome(applicant: Applicant, docType: DocumentType, outcome: SandboxOutcome, now = new Date()) {
  const o = outcome === 'auto' || outcome === 'blurry_once' ? 'pass' : outcome
  const surname = o === 'name_mismatch' ? 'HABIMANA' : upper(applicant.last_name)
  const given = upper(applicant.first_name)
  const dob = o === 'dob_mismatch' ? shiftDate(applicant.date_of_birth, 400) : o === 'underage' ? iso(addDays(now, -365 * 16)).slice(0, 10) : applicant.date_of_birth
  const expiry = o === 'expired_document' ? iso(addDays(now, -95)).slice(0, 10) : iso(addDays(now, 365 * 5)).slice(0, 10)
  const number = (docType === 'passport' ? 'PC' : docType === 'id_card' ? '1199' : 'DL') + rid(7, '0123456789')

  const age = Math.floor((now.getTime() - new Date(dob).getTime()) / (365.25 * 86400000))
  const checks: Check[] = []
  const c = (name: CheckName, status: Check['status'], summary: string, reasons: string[] = [], extra: Partial<Check> = {}) =>
    checks.push({ name, status, summary, reasons, warnings: [], ...extra })

  if (o === 'expired_document') c('document', 'fail', `Expired on ${fmtDate(expiry)}`, ['DOCUMENT_EXPIRED'])
  else if (o === 'underage') c('document', 'fail', `Applicant is ${age}, under 18`, ['UNDERAGE'])
  else c('document', 'pass', 'MRZ read, check digits valid, not expired')

  if (o === 'name_mismatch') c('name', 'fail', `Read “${given} ${surname}”, expected “${upper(applicant.first_name)} ${upper(applicant.last_name)}”`, ['NAME_MISMATCH'], { score: 0.41 })
  else c('name', 'pass', `Read “${given} ${surname}” · 100% match`, [], { score: 1 })

  if (o === 'dob_mismatch') c('date_of_birth', 'fail', `Read ${fmtDate(dob)}, expected ${fmtDate(applicant.date_of_birth)}`, ['DOB_MISMATCH'])
  else c('date_of_birth', 'pass', `${fmtDate(dob)} · exact match · age ${age}`)

  if (o === 'liveness_fail') c('liveness', 'fail', 'Head movement not detected · possible photo or screen', ['LIVENESS_FAILED'], { score: 0.22, threshold: 0.8 })
  else c('liveness', 'pass', '3 of 3 head movements · no screen or print detected', [], { score: 0.97, threshold: 0.8 })

  const face = o === 'face_mismatch' ? 0.28 : o === 'face_borderline' ? 0.43 : 0.71 + Math.random() * 0.15
  if (face < REVIEW_BAND) c('face_match', 'fail', `Similarity ${face.toFixed(2)}, below the ${FACE_THRESHOLD} threshold`, ['FACE_MISMATCH'], { score: face, threshold: FACE_THRESHOLD })
  else if (face < FACE_THRESHOLD) c('face_match', 'review', `Similarity ${face.toFixed(2)}, within the review band`, ['FACE_MATCH_BORDERLINE'], { score: face, threshold: FACE_THRESHOLD })
  else c('face_match', 'pass', `Similarity ${face.toFixed(2)} · threshold ${FACE_THRESHOLD}`, [], { score: face, threshold: FACE_THRESHOLD })

  const status: VerificationStatus = checks.some(x => x.status === 'fail') ? 'failed' : checks.some(x => x.status === 'review') ? 'needs_review' : 'passed'
  return {
    status,
    checks,
    reasons: checks.flatMap(x => x.reasons),
    document: { document_type: docType, number, nationality: applicant.country || 'RWA', surname, given_names: given, date_of_birth: dob, expiry_date: expiry, mrz_valid: true },
  }
}

function shiftDate(d: string, days: number) { return iso(addDays(new Date(d), days)).slice(0, 10) }
export function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------- seed
function seed(): Db {
  const clients: Client[] = [
    { id: 'c_acme', name: 'Acme Bank', email: 'aline@acmebank.rw', plan: 'Business', status: 'active', created_at: iso(daysAgo(240)) },
    { id: 'c_momo', name: 'MoMo Pay', email: 'ops@momopay.rw', plan: 'Enterprise', status: 'active', created_at: iso(daysAgo(300)) },
    { id: 'c_kivu', name: 'Lake Kivu Telecom', email: 'kyc@kivutel.rw', plan: 'Business', status: 'active', created_at: iso(daysAgo(210)) },
    { id: 'c_sacco', name: 'Umurenge SACCO', email: 'it@umurenge.rw', plan: 'Starter', status: 'active', created_at: iso(daysAgo(120)) },
    { id: 'c_inyange', name: 'Inyange Insurance', email: 'risk@inyange.rw', plan: 'Business', status: 'active', created_at: iso(daysAgo(90)) },
    { id: 'c_rentals', name: 'Kigali Rentals', email: 'hello@kigalirentals.rw', plan: 'Starter', status: 'suspended', created_at: iso(daysAgo(60)) },
  ]
  const people: Array<[string, string, string, string, SandboxOutcome | 'pending' | 'in_progress', DocumentType, number, number]> = [
    ['c_acme', 'Aline', 'Mukamana', '1994-03-14', 'face_mismatch', 'passport', 0, 3],
    ['c_acme', 'Jean Bosco', 'Habimana', '1988-07-02', 'pass', 'id_card', 0, 5],
    ['c_acme', 'Grace', 'Ingabire', '1990-07-22', 'face_borderline', 'driving_license', 0, 6],
    ['c_acme', 'Eric', 'Niyonzima', '1996-11-30', 'pass', 'passport', 0, 9],
    ['c_acme', 'Diane', 'Uwimana', '1999-01-18', 'pending', 'id_card', 0, 11],
    ['c_acme', 'Patrick', 'Mugisha', '1985-05-05', 'pass', 'passport', 1, 2],
    ['c_acme', 'Claudine', 'Mutoni', '2001-09-09', 'expired_document', 'id_card', 1, 4],
    ['c_acme', 'Esther', 'Uwera', '1993-02-27', 'in_progress', 'passport', 1, 7],
    ['c_acme', 'Samuel', 'Nkurunziza', '1979-12-12', 'name_mismatch', 'id_card', 2, 1],
    ['c_acme', 'Olivier', 'Hakizimana', '1992-04-04', 'pass', 'driving_license', 2, 6],
    ['c_acme', 'Chantal', 'Mukeshimana', '1997-08-15', 'liveness_fail', 'passport', 3, 2],
    ['c_acme', 'Fabrice', 'Iradukunda', '1995-06-21', 'pass', 'id_card', 3, 8],
    ['c_momo', 'Innocent', 'Ndayisaba', '1991-10-10', 'pass', 'id_card', 0, 4],
    ['c_momo', 'Beatrice', 'Nyirahabimana', '1987-03-03', 'face_borderline', 'id_card', 0, 8],
    ['c_kivu', 'David', 'Kamanzi', '1983-01-25', 'pass', 'passport', 1, 3],
    ['c_sacco', 'Yvette', 'Umutoni', '2000-12-01', 'dob_mismatch', 'id_card', 1, 9],
    ['c_inyange', 'Theo', 'Gasana', '1998-06-06', 'pass', 'passport', 2, 5],
  ]
  const verifications = people.map(([cid, fn, ln, dob, outcome, docType, d, h]) => {
    const created = daysAgo(d, h, Math.floor(Math.random() * 50))
    const client = clients.find(c => c.id === cid)!
    const applicant: Applicant = { first_name: fn, last_name: ln, date_of_birth: dob, country: 'RWA', email: `${fn.split(' ')[0].toLowerCase()}.${ln.toLowerCase()}@example.com` }
    const v = blankVerification(client, applicant, created, 7)
    v.document_type = docType
    if (outcome === 'pending') return v
    v.started_at = iso(new Date(created.getTime() + 4 * 60000))
    if (outcome === 'in_progress') { v.status = 'in_progress'; return v }
    const r = buildOutcome(applicant, docType, outcome, created)
    Object.assign(v, r)
    v.completed_at = iso(new Date(created.getTime() + 6 * 60000))
    v.decision_seconds = 8 + Math.round(Math.random() * 9)
    v.liveness_attempts = outcome === 'liveness_fail' ? 3 : 1
    v.evidence = seedEvidence(v)
    return v
  })
  const now = Date.now()
  return {
    clients,
    verifications: verifications.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    apiKeys: {
      c_acme: [
        { id: 'k1', name: 'Production server', prefix: 'zid_live_3f9a', created_at: iso(daysAgo(46)), last_used_at: iso(new Date(now - 2 * 60000)), revoked: false },
        { id: 'k2', name: 'Staging', prefix: 'zid_test_81bc', created_at: iso(daysAgo(46)), last_used_at: iso(daysAgo(1)), revoked: false },
        { id: 'k3', name: 'Old mobile backend', prefix: 'zid_live_c02e', created_at: iso(daysAgo(160)), last_used_at: iso(daysAgo(66)), revoked: true },
      ],
    },
    documentAttempts: {},
  }
}

function blankVerification(client: Client, applicant: Applicant, created: Date, ttlDays: number, reference?: string): Verification {
  const t = token()
  return {
    id: 'v_' + rid(10).toLowerCase(),
    reference: reference || 'ZID-' + rid(6),
    client_id: client.id,
    client_name: client.name,
    status: 'pending',
    applicant,
    services: ['document', 'face'],
    session_token: t,
    session_url: `${location.origin}/v/${t}`,
    checks: [],
    reasons: [],
    evidence: [],
    liveness_attempts: 0,
    reviews: [],
    created_at: iso(created),
    expires_at: iso(addDays(created, ttlDays)),
  }
}

function seedEvidence(v: Verification): EvidenceFile[] {
  const d = v.document!
  const mismatch = v.reasons.includes('FACE_MISMATCH')
  return [
    { id: 'f1', kind: 'document_front', name: 'document-front.jpg', size_kb: 812, url: documentArt({ surname: d.surname, given: d.given_names, dob: d.date_of_birth, expiry: d.expiry_date, number: d.number }) },
    { id: 'f2', kind: 'portrait', name: 'document-portrait.jpg', size_kb: 46, url: faceArt(v.reference) },
    { id: 'f3', kind: 'selfie', name: 'liveness-selfie.jpg', size_kb: 214, url: faceArt(mismatch ? v.reference + 'x' : v.reference, true) },
  ]
}

// ---------------------------------------------------------------- auth
export function currentSession(role: Session['role']): Session | null {
  try {
    const raw = localStorage.getItem(role === 'client' ? SESSION_KEY : STAFF_SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch { return null }
}

export async function login(email: string, password: string): Promise<Session> {
  await wait()
  if (!email.includes('@') || password.length < 6) throw new ApiError(401, 'Email or password is incorrect.')
  const db = load()
  const client = db.clients.find(c => c.email.toLowerCase() === email.toLowerCase()) || db.clients[0]
  if (client.status === 'suspended') throw new ApiError(403, 'This account is suspended. Contact support.')
  const s: Session = { role: 'client', name: client.name, email, client_id: client.id }
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  return s
}

/** Same body as the backend's POST /v1/auth/register (app/schemas/auth.py RegisterRequest). */
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

/** Opens the account and signs it in at once, like the backend's register. */
export async function register(body: RegisterRequest): Promise<Session> {
  await wait()
  // The backend's MIN_PASSWORD_LENGTH is 12.
  if (body.password.length < 12) throw new ApiError(422, 'Use at least 12 characters for the password.')
  const db = load()
  if (db.clients.some(c => c.email.toLowerCase() === body.email.toLowerCase())) throw new ApiError(409, 'An account with this email already exists.')
  const name = `${body.first_name} ${body.last_name}`.trim()
  const client: Client = {
    id: 'c_' + rid(8).toLowerCase(), name, email: body.email, plan: 'Starter', status: 'active', created_at: iso(new Date()),
    phone: `${body.country_code} ${body.phone}`.trim(), country: body.country, date_of_birth: body.date_of_birth,
  }
  db.clients.push(client)
  save(db)
  const s: Session = { role: 'client', name, email: body.email, client_id: client.id }
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  return s
}

export async function requestPasswordReset(email: string): Promise<string> {
  await wait()
  if (!EMAIL_PATTERN.test(email.trim())) throw new ApiError(422, 'Enter a valid email address.')
  const normalized = email.trim().toLowerCase()
  const codes = readResetCodes()
  if (load().clients.some(c => c.email.toLowerCase() === normalized && c.status === 'active')) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
    codes[normalized] = code
    localStorage.setItem(RESET_CODES_KEY, JSON.stringify(codes))
    return code
  }
  return ''
}

export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await wait()
  const normalized = email.trim().toLowerCase()
  const normalizedCode = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalizedCode)) throw new ApiError(400, 'Enter the 6-digit code from your email.')
  if (password.length < 12) throw new ApiError(422, 'Use at least 12 characters for the password.')
  const codes = readResetCodes()
  if (codes[normalized] !== normalizedCode) throw new ApiError(400, 'That reset code is invalid or has expired.')
  delete codes[normalized]
  localStorage.setItem(RESET_CODES_KEY, JSON.stringify(codes))
  logout('client')
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readResetCodes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(RESET_CODES_KEY) || '{}') as Record<string, string> }
  catch { return {} }
}

export async function staffLogin(email: string, password: string, code: string): Promise<Session> {
  await wait()
  if (!email.includes('@') || password.length < 6) throw new ApiError(401, 'Email or password is incorrect.')
  if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) throw new ApiError(401, 'Enter the 6-digit code from your authenticator app.')
  const s: Session = { role: 'staff', name: 'Grace Uwase', email }
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(s))
  return s
}

export function logout(role: Session['role']) {
  localStorage.removeItem(role === 'client' ? SESSION_KEY : STAFF_SESSION_KEY)
}

// ---------------------------------------------------------------- client API
function mine(): { db: Db; client: Client } {
  const s = currentSession('client')
  if (!s) throw new ApiError(401, 'Not signed in.')
  const db = load()
  const client = db.clients.find(c => c.id === s.client_id)
  if (!client) throw new ApiError(401, 'Not signed in.')
  return { db, client }
}

function refreshExpiry(v: Verification) {
  if ((v.status === 'pending' || v.status === 'in_progress') && new Date(v.expires_at) < new Date()) v.status = 'expired'
}

export async function listVerifications(opts: { status?: VerificationStatus | 'all'; q?: string } = {}) {
  await wait(250)
  const { db, client } = mine()
  let rows = db.verifications.filter(v => v.client_id === client.id)
  rows.forEach(refreshExpiry)
  const counts = { all: rows.length, passed: 0, failed: 0, needs_review: 0, pending: 0, in_progress: 0, expired: 0 } as Record<string, number>
  rows.forEach(v => counts[v.status]++)
  if (opts.status && opts.status !== 'all') rows = rows.filter(v => v.status === opts.status)
  if (opts.q) {
    const q = opts.q.toLowerCase()
    rows = rows.filter(v => `${v.reference} ${v.applicant.first_name} ${v.applicant.last_name} ${v.customer_id || ''}`.toLowerCase().includes(q))
  }
  return { rows, counts }
}

export async function clientStats() {
  await wait(250)
  const { db, client } = mine()
  const rows = db.verifications.filter(v => v.client_id === client.id)
  const done = rows.filter(v => ['passed', 'failed', 'needs_review'].includes(v.status))
  const passed = rows.filter(v => v.status === 'passed').length
  const avg = done.length ? done.reduce((a, v) => a + (v.decision_seconds || 0), 0) / done.length : 0
  const reasons: Record<string, number> = {}
  rows.filter(v => v.status === 'failed').forEach(v => v.reasons.forEach(r => (reasons[r] = (reasons[r] || 0) + 1)))
  return {
    total: rows.length,
    passed,
    failed: rows.filter(v => v.status === 'failed').length,
    review: rows.filter(v => v.status === 'needs_review').length,
    pending: rows.filter(v => v.status === 'pending' || v.status === 'in_progress').length,
    passRate: done.length ? passed / done.length : 0,
    avgSeconds: avg,
    topReasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5),
    recent: rows.slice(0, 5),
  }
}

export async function getVerification(reference: string, scope: 'client' | 'staff' = 'client'): Promise<Verification> {
  await wait(250)
  const db = scope === 'staff' ? staff() : mine().db
  const v = db.verifications.find(x => x.reference === reference)
  const s = currentSession('client')
  if (!v || (scope === 'client' && v.client_id !== s?.client_id)) throw new ApiError(404, 'Verification not found.')
  refreshExpiry(v)
  return v
}

export async function createVerification(req: CreateVerificationRequest): Promise<Verification> {
  await wait(500)
  const { db, client } = mine()
  const a = req.applicant
  if (!a.first_name.trim() || !a.last_name.trim()) throw new ApiError(422, 'First and last name are required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date_of_birth)) throw new ApiError(422, 'Date of birth must be a valid date.')
  const v = blankVerification(client, { ...a, first_name: a.first_name.trim(), last_name: a.last_name.trim(), country: a.country || 'RWA' }, new Date(), req.ttl_days || 7)
  if (req.reference) v.customer_id = req.reference
  db.verifications.unshift(v)
  save(db)
  return v
}

export async function resendLink(reference: string, email: string) {
  await wait(400)
  if (!email.includes('@')) throw new ApiError(422, 'Enter a valid email address.')
  return { sent_to: email, reference }
}

export async function listApiKeys(): Promise<ApiKey[]> {
  await wait(250)
  const { db, client } = mine()
  return db.apiKeys[client.id] || []
}

export async function createApiKey(name: string): Promise<CreatedApiKey> {
  await wait(500)
  const { db, client } = mine()
  if (!name.trim()) throw new ApiError(422, 'Give the key a name.')
  const secret = 'zid_live_' + rid(32, 'abcdef0123456789')
  const key: ApiKey = { id: 'k_' + rid(6).toLowerCase(), name: name.trim(), prefix: secret.slice(0, 13), created_at: iso(new Date()), revoked: false }
  db.apiKeys[client.id] = [key, ...(db.apiKeys[client.id] || [])]
  save(db)
  return { ...key, secret }
}

export async function revokeApiKey(id: string) {
  await wait(300)
  const { db, client } = mine()
  const k = (db.apiKeys[client.id] || []).find(x => x.id === id)
  if (k) k.revoked = true
  save(db)
}

// ---------------------------------------------------------------- applicant session
function byToken(t: string) {
  const db = load()
  const v = db.verifications.find(x => x.session_token === t)
  if (!v) throw new ApiError(404, 'This link is not valid.')
  refreshExpiry(v)
  return { db, v }
}

// Shufti's step order: consent -> face -> document -> verification -> result.
export async function getSession(t: string): Promise<SessionView> {
  await wait(300)
  const { v } = byToken(t)
  const hasSelfie = v.evidence.some(e => e.kind === 'selfie')
  const hasDoc = v.evidence.some(e => e.kind === 'document_front')
  const finished = ['passed', 'failed', 'needs_review'].includes(v.status)
  const done: string[] = []
  if (v.started_at) done.push('consent')
  if (hasSelfie) done.push('face')
  if (hasDoc) done.push('document')
  return {
    reference: v.reference,
    status: v.status,
    client_name: v.client_name,
    applicant_first_name: v.applicant.first_name,
    next_step: finished ? 'done' : !v.started_at ? 'consent' : !hasSelfie ? 'face' : !hasDoc ? 'document' : 'verify',
    completed_steps: done,
    expired: v.status === 'expired',
    expires_at: v.expires_at,
    document_types: ['passport', 'id_card', 'driving_license'],
  }
}

export async function startSession(t: string) {
  await wait(250)
  const { db, v } = byToken(t)
  if (v.status === 'expired') throw new ApiError(410, 'This link has expired.')
  v.started_at = v.started_at || iso(new Date())
  v.status = 'in_progress'
  save(db)
}

/** Step 1: the selfie / liveness capture. The decision is made at the end. */
export async function submitFace(t: string, input: { frames: string[]; outcome: SandboxOutcome }) {
  await wait(900 + Math.random() * 500)
  const { db, v } = byToken(t)
  // No camera (e.g. a desktop without one): the mock stores a placeholder selfie.
  const selfie = input.frames[0] || faceArt(v.reference + (input.outcome === 'face_mismatch' ? 'x' : ''), true)
  v.evidence = v.evidence.filter(e => e.kind !== 'selfie')
  v.evidence.push({ id: 'f_selfie', kind: 'selfie', name: 'liveness-selfie.jpg', size_kb: kb(selfie), url: selfie })
  v.liveness_attempts = input.outcome === 'liveness_fail' ? 3 : 1
  save(db)
  return { status: 'pass' as const }
}

/** Step 2: document photos. Returns retake when the image quality is not good enough. */
export async function submitDocument(t: string, input: {
  document_type: DocumentType; country: string; front: string; back?: string; quality: QualityReport; outcome: SandboxOutcome
}): Promise<DocumentStepResult> {
  await wait(900 + Math.random() * 700)
  const { db, v } = byToken(t)
  const attempts = (db.documentAttempts[t] = (db.documentAttempts[t] || 0) + 1)
  let quality = input.quality
  if (input.outcome === 'blurry_once' && attempts === 1) quality = { ...quality, ok: false, problems: ['blur'], sharpness: Math.min(quality.sharpness, 18) }
  if (!quality.ok) {
    save(db)
    const p = quality.problems[0]
    return {
      status: 'retake', quality,
      message: p === 'blur' ? 'Image is blurry. Hold the document steady and make sure it is in focus.'
        : p === 'dark' ? 'Image is too dark. Move closer to a window or a lamp.'
        : p === 'bright' ? 'There is too much glare. Tilt the document away from the light.'
        : 'Image is too small. Move the document closer so it fills the frame.',
    }
  }
  v.document_type = input.document_type
  v.applicant.country = input.country
  v.evidence = v.evidence.filter(e => !e.kind.startsWith('document'))
  v.evidence.push({ id: 'f_front', kind: 'document_front', name: 'document-front.jpg', size_kb: kb(input.front), url: input.front })
  if (input.back) v.evidence.push({ id: 'f_back', kind: 'document_back', name: 'document-back.jpg', size_kb: kb(input.back), url: input.back })
  save(db)
  return { status: 'pass', quality, message: `${docLabel[input.document_type]} captured.` }
}

/** Step 3: run every check and decide. The applicant only learns that it finished. */
export async function completeSession(t: string, input: { outcome: SandboxOutcome }) {
  await wait(2200 + Math.random() * 1200)
  const { db, v } = byToken(t)
  const r = buildOutcome(v.applicant, v.document_type || 'passport', input.outcome)
  Object.assign(v, r)
  v.completed_at = iso(new Date())
  v.decision_seconds = Math.max(1, Math.round((Date.now() - new Date(v.started_at || v.created_at).getTime()) / 1000))
  if (!v.evidence.some(e => e.kind === 'document_front')) v.evidence.unshift(...seedEvidence(v).slice(0, 1))
  const front = v.evidence.find(e => e.kind === 'document_front')
  v.evidence = v.evidence.filter(e => e.kind !== 'portrait')
  // The real backend crops the portrait from the document; the mock reuses the front image.
  v.evidence.push({ id: 'f_portrait', kind: 'portrait', name: 'document-portrait.jpg', size_kb: 46, url: front?.url })
  save(db)
  return { completed: true }
}

const kb = (dataUrl: string) => Math.max(1, Math.round((dataUrl.length * 3) / 4 / 1024))

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
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = daysAgo(13 - i)
    const base = 1300 + Math.round(900 * Math.abs(Math.sin(i * 1.7)))
    return { label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), passed: Math.round(base * 0.86), review: Math.round(base * 0.065), failed: Math.round(base * 0.075) }
  })
  return {
    today: 2418,
    passRate: done.length ? done.filter(v => v.status === 'passed').length / done.length : 0,
    medianSeconds: 11.4,
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
