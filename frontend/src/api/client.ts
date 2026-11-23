// The client dashboard, against the backend: API keys, verifications, metrics.
//   /v1/api-keys                    list, create, revoke
//   /v1/verifications               create, list (with a count per status)
//   /v1/verifications/{reference}   one in full; evidence under .../evidence/{id}
//   /v1/metrics/overview            completion time and decline reasons
// Backend shapes are mapped onto the dashboard's own types (types.ts), so the
// pages and cards stay the same whether a verification came from here or the
// admin console's mock.
import { ApiError } from './errors'
import { API, request } from './http'
import { getStaffVerification } from './mock'
import { currentSession } from './session'
import type {
  ApiKey, Check, CheckStatus, CreateVerificationRequest, CreatedApiKey, DocumentType,
  EvidenceFile, Verification, VerificationStatus,
} from './types'

const token = () => {
  const s = currentSession('client')
  if (!s) throw new ApiError(401, 'Your session has ended. Log in again.')
  return s.token
}
const call = <T>(path: string, init: { method?: string; body?: unknown } = {}) => request<T>(path, { ...init, token: token() })

// ---------------------------------------------------------------- backend shapes
interface KeyRow {
  id: string; name: string; prefix: string; created_at: string; expires_at: string
  last_used_at: string | null; revoked_at: string | null; suspended_at: string | null; state: string
}
interface KeyList { items: KeyRow[]; total: number; state_counts: Record<string, number> }
interface CreatedKey extends Omit<KeyRow, 'state'> { key: string }

interface ApplicantView { customer_id: string | null; name: string | null; email: string | null; country: string | null }
interface Summary {
  id: string; reference: string; status: VerificationStatus; services: string[]; document_type: string | null
  reasons: string[]; client: { id: string; name: string; email: string }; applicant: ApplicantView
  created_at: string; completed_at: string | null; expires_at: string | null
}
interface SummaryList { items: Summary[]; total: number; page: number; page_size: number; status_counts: Record<string, number> }

interface StepCheck { name: string; status: string; reasons: string[]; warnings: string[] }
interface Step {
  step: string; attempt: number; status: string; reasons: string[]; warnings: string[]
  checks: StepCheck[]; match_score: number | null; match_threshold: number | null
  started_at: string | null; completed_at: string | null
}
interface Detail extends Summary {
  session_url: string; customer_id: string | null; started_at: string | null; steps: Step[]
  document: {
    document_type: string; decision: string; full_name: string | null; date_of_birth: string | null
    document_number_last4: string | null; issuing_country: string | null; nationality: string | null; expiry_date: string | null
  } | null
  evidence: Array<{ id: string; kind: string; step: string | null; content_type: string; byte_size: number }>
  reviews: Array<{ action: string; by: string; note: string | null; at: string }>
  claimed: { first_name?: string; last_name?: string; date_of_birth?: string; email?: string; country?: string }
}

interface Overview {
  completion_seconds: { value: number | null }
  decline_reasons: Array<{ key: string; count: number }>
}

// ---------------------------------------------------------------- API keys
function toKey(k: KeyRow): ApiKey {
  return {
    id: k.id, name: k.name, prefix: k.prefix, created_at: k.created_at, last_used_at: k.last_used_at ?? undefined,
    expires_at: k.expires_at, state: k.state, revoked: k.revoked_at !== null,
  }
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const list = await call<KeyList>('/api-keys?page_size=100')
  return list.items.map(toKey)
}

export async function createApiKey(name: string, expiresInDays = 90): Promise<CreatedApiKey> {
  if (!name.trim()) throw new ApiError(422, 'Give the key a name.')
  const k = await call<CreatedKey>('/api-keys', { body: { name: name.trim(), expires_in_days: expiresInDays } })
  return { ...toKey({ ...k, state: 'active' }), secret: k.key }
}

export async function revokeApiKey(id: string) {
  await call(`/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
}

// ---------------------------------------------------------------- verifications
const DOCS: DocumentType[] = ['passport', 'id_card', 'driving_license']
const asDoc = (d: string | null | undefined) => (DOCS.includes(d as DocumentType) ? (d as DocumentType) : undefined)

/** "Jane Doe" kept whole as the first name: the cards join first and last again. */
function nameOf(a: ApplicantView, claimed?: Detail['claimed']) {
  if (claimed?.first_name || claimed?.last_name) return { first_name: claimed.first_name ?? '', last_name: claimed.last_name ?? '' }
  return { first_name: a.name ?? 'Unnamed applicant', last_name: '' }
}

function fromSummary(s: Summary): Verification {
  return {
    // applicant.customer_id is the backend's own id for the person, not one the client gave: not shown.
    id: s.id, reference: s.reference,
    client_id: s.client.id, client_name: s.client.name, status: s.status,
    applicant: { ...nameOf(s.applicant), date_of_birth: '', email: s.applicant.email ?? undefined, country: s.applicant.country ?? undefined },
    services: s.services, session_token: '', session_url: '', document_type: asDoc(s.document_type),
    checks: [], reasons: s.reasons, evidence: [], liveness_attempts: 0, reviews: [],
    created_at: s.created_at, completed_at: s.completed_at ?? undefined, expires_at: s.expires_at ?? '',
  }
}

const STEP_LABEL: Record<string, string> = {
  document: 'Document', face: 'Face check', address: 'Proof of address', aml: 'AML screening',
  due_diligence: 'Questionnaire', consent: 'Consent',
}
const status = (s: string): CheckStatus => (['pass', 'fail', 'review', 'skipped', 'pending'].includes(s) ? (s as CheckStatus) : 'pending')
const worst = (list: string[]): CheckStatus =>
  list.includes('fail') ? 'fail' : list.includes('review') ? 'review' : list.length && list.every(x => x === 'skipped') ? 'skipped'
    : list.some(x => x === 'pending') || !list.length ? 'pending' : 'pass'
const said = (reasons: string[], fallback: string) => (reasons.length ? reasons.join(', ') : fallback)

/** The session card's rows: the five familiar checks where the steps ran them, then any other step. */
function checksOf(steps: Step[]): Check[] {
  const out: Check[] = []
  const doc = steps.find(s => s.step === 'document')
  const face = steps.find(s => s.step === 'face')
  if (doc) {
    const nameCheck = doc.checks.find(c => c.name === 'name_match')
    const dobCheck = doc.checks.find(c => c.name === 'date_of_birth_match')
    const rest = doc.checks.filter(c => c !== nameCheck && c !== dobCheck)
    const docStatus = rest.length ? worst(rest.map(c => c.status)) : status(doc.status)
    const docReasons = rest.flatMap(c => c.reasons)
    out.push({ name: 'document', status: docStatus, reasons: docReasons, warnings: doc.warnings, summary: said(docReasons, docStatus === 'pass' ? 'Read, checked and not expired' : docStatus === 'pending' ? 'Not captured yet' : 'See the reasons') })
    if (nameCheck) out.push({ name: 'name', status: status(nameCheck.status), reasons: nameCheck.reasons, warnings: nameCheck.warnings, summary: said(nameCheck.reasons, 'Compared with the details you entered') })
    if (dobCheck) out.push({ name: 'date_of_birth', status: status(dobCheck.status), reasons: dobCheck.reasons, warnings: dobCheck.warnings, summary: said(dobCheck.reasons, 'Compared with the details you entered') })
  }
  if (face) {
    const match = face.checks.find(c => c.name === 'face_match')
    const live = face.checks.filter(c => c !== match)
    const liveStatus = live.length ? worst(live.map(c => c.status)) : match ? status(face.status) : status(face.status)
    const liveReasons = live.flatMap(c => c.reasons)
    out.push({ name: 'liveness', status: liveStatus, reasons: liveReasons, warnings: [], summary: said(liveReasons, liveStatus === 'pass' ? 'Head movements done, no photo or screen' : liveStatus === 'pending' ? 'Not done yet' : 'See the reasons') })
    if (match || face.match_score !== null) {
      const st = match ? status(match.status) : status(face.status)
      out.push({
        name: 'face_match', status: st, reasons: match?.reasons ?? [], warnings: match?.warnings ?? [],
        summary: face.match_score !== null ? `Similarity ${face.match_score.toFixed(2)}${face.match_threshold !== null ? ` · threshold ${face.match_threshold}` : ''}` : 'Compared with the document photo',
        score: face.match_score ?? undefined, threshold: face.match_threshold ?? undefined,
      })
    }
  }
  for (const s of steps) {
    if (s.step === 'document' || s.step === 'face') continue
    out.push({ name: s.step, label: STEP_LABEL[s.step] ?? s.step, status: status(s.status), reasons: s.reasons, warnings: s.warnings, summary: said(s.reasons, status(s.status) === 'pending' ? 'Not done yet' : 'Checked') })
  }
  return out
}

// Evidence is behind the sign-in, so an <img> cannot fetch it by itself: each file
// is fetched once with the token and shown from a blob: URL.
const blobs = new Map<string, string>()
async function fileUrl(path: string): Promise<string | undefined> {
  const hit = blobs.get(path)
  if (hit) return hit
  try {
    const res = await fetch(`${API}/v1${path}`, { headers: { Authorization: `Bearer ${token()}` } })
    if (!res.ok) return undefined
    const url = URL.createObjectURL(await res.blob())
    blobs.set(path, url)
    return url
  } catch {
    return undefined
  }
}

const KIND_NAME: Record<string, string> = {
  document_front: 'document-front', document_back: 'document-back', portrait: 'selfie', document_portrait: 'document-portrait',
  challenge_video: 'liveness-video',
}

async function evidenceOf(d: Detail): Promise<EvidenceFile[]> {
  const base = `/verifications/${encodeURIComponent(d.reference)}/evidence`
  return Promise.all(d.evidence.map(async f => {
    const video = f.content_type.startsWith('video/')
    const image = f.content_type.startsWith('image/')
    const ext = f.content_type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'
    return {
      id: f.id,
      kind: f.kind as EvidenceFile['kind'],
      name: `${KIND_NAME[f.kind] ?? f.kind}.${ext}`,
      size_kb: Math.max(1, Math.round(f.byte_size / 1024)),
      url: image ? await fileUrl(`${base}/${f.id}`) : video ? await fileUrl(`${base}/${f.id}/thumbnail`) : undefined,
    }
  }))
}

function fromDetail(d: Detail, evidence: EvidenceFile[]): Verification {
  const face = d.steps.find(s => s.step === 'face')
  const doc = d.document
  return {
    ...fromSummary(d),
    applicant: {
      ...nameOf(d.applicant, d.claimed),
      date_of_birth: d.claimed?.date_of_birth ?? '',
      email: d.claimed?.email ?? d.applicant.email ?? undefined,
      country: d.claimed?.country ?? d.applicant.country ?? undefined,
    },
    session_url: d.session_url,
    session_token: d.session_url.split('/').pop() ?? '',
    started_at: d.started_at ?? undefined,
    checks: checksOf(d.steps),
    evidence,
    liveness_attempts: face && face.status !== 'pending' ? face.attempt : 0,
    reviews: d.reviews.map(r => ({ at: r.at, by: r.by, action: r.action === 'redo_requested' ? 'redo' : (r.action as 'approved' | 'declined'), note: r.note ?? '' })),
    document: doc ? {
      document_type: asDoc(doc.document_type) ?? 'id_card',
      full_name: doc.full_name ?? undefined,
      number: doc.document_number_last4 ? `•••• ${doc.document_number_last4}` : '—',
      nationality: doc.nationality ?? doc.issuing_country ?? '—',
      issuing_country: doc.issuing_country ?? undefined,
      date_of_birth: doc.date_of_birth ?? '',
      expiry_date: doc.expiry_date ?? '',
      decision: doc.decision,
    } : undefined,
    decision_seconds: d.started_at && d.completed_at
      ? Math.max(1, Math.round((+new Date(d.completed_at) - +new Date(d.started_at)) / 1000)) : undefined,
  }
}

export async function listVerifications(opts: { status?: VerificationStatus | 'all'; q?: string } = {}) {
  const p = new URLSearchParams({ page_size: '100' })
  if (opts.status && opts.status !== 'all') p.set('status', opts.status)
  if (opts.q?.trim()) p.set('q', opts.q.trim())
  // The counts are for the search alone, so every filter chip keeps its number.
  const [list, all] = await Promise.all([
    call<SummaryList>(`/verifications?${p}`),
    opts.status && opts.status !== 'all'
      ? call<SummaryList>(`/verifications?${new URLSearchParams({ page_size: '1', ...(opts.q?.trim() ? { q: opts.q.trim() } : {}) })}`)
      : null,
  ])
  const counts = (all ?? list).status_counts
  return {
    rows: list.items.map(fromSummary),
    counts: { ...counts, all: Object.values(counts).reduce((a, b) => a + b, 0) } as Record<string, number>,
    total: list.total,
  }
}

/** One verification in full. The admin console's copy still comes from the mock. */
export async function getVerification(reference: string, scope: 'client' | 'staff' = 'client'): Promise<Verification> {
  if (scope === 'staff') return getStaffVerification(reference)
  const d = await call<Detail>(`/verifications/${encodeURIComponent(reference)}`)
  return fromDetail(d, await evidenceOf(d))
}

export async function createVerification(req: CreateVerificationRequest): Promise<Verification> {
  const a = req.applicant
  const v = await call<{ reference: string }>('/verifications', {
    body: {
      applicant: { first_name: a.first_name.trim(), last_name: a.last_name.trim(), date_of_birth: a.date_of_birth, ...(a.email ? { email: a.email } : {}) },
      services: ['document', 'face'],
      ...(req.reference?.trim() ? { reference: req.reference.trim() } : {}),
      ...(req.ttl_days ? { ttl_days: req.ttl_days } : {}),
      ...(req.document_types?.length ? { document_types: req.document_types } : {}),
    },
  })
  return getVerification(v.reference)
}

/** The PDF report the backend builds, downloaded with the sign-in. */
export async function downloadReport(reference: string) {
  const res = await fetch(`${API}/v1/verifications/${encodeURIComponent(reference)}/report`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new ApiError(res.status, 'The report could not be made. Try again in a moment.')
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${reference}.pdf`
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ---------------------------------------------------------------- dashboard
const day = (d: Date) => d.toISOString().slice(0, 10)

export async function clientStats() {
  const to = new Date()
  const from = new Date(to.getTime() - 29 * 86400000)
  const [recent, overview] = await Promise.all([
    call<SummaryList>('/verifications?page_size=5'),
    call<Overview>(`/metrics/overview?from=${day(from)}&to=${day(to)}`),
  ])
  const c = recent.status_counts
  const n = (k: string) => c[k] ?? 0
  const decided = n('passed') + n('failed') + n('needs_review')
  return {
    total: Object.values(c).reduce((a, b) => a + b, 0),
    passed: n('passed'),
    failed: n('failed'),
    review: n('needs_review'),
    pending: n('pending') + n('in_progress'),
    passRate: decided ? n('passed') / decided : 0,
    avgSeconds: overview.completion_seconds.value ?? 0,
    topReasons: overview.decline_reasons.slice(0, 5).map(r => [r.key, r.count] as [string, number]),
    recent: recent.items.map(fromSummary),
  }
}
