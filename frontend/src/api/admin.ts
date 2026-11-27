// The admin console, against the backend's /v1/console API (staff token):
//   /console/metrics/overview                 volume, pass rate, decision time, reasons
//   /console/verifications                    every client's, filtered, with a count per status
//   /console/verifications/{id}               one in full; files under .../files/{file_id}
//   /console/verifications/{id}/approve|decline|redo
//   /console/clients                          every client account
//   /console/clients/{id}/status              suspend or reactivate
// Console verifications are addressed by id (references are only unique per client).
import { ApiError } from './errors'
import { changed } from './events'
import { API, request } from './http'
import { currentSession } from './session'
import { evidenceOf, fromDetail, fromSummary, type Detail, type SummaryList } from './client'
import type { Client, Verification, VerificationStatus } from './types'

const token = () => {
  const s = currentSession('staff')
  if (!s) throw new ApiError(401, 'Your session has ended. Log in again.')
  return s.token
}
const call = <T>(path: string, init: { method?: string; body?: unknown } = {}) => request<T>(path, { ...init, token: token() })

/** Whether the signed-in staff member may decide cases, and manage client accounts. */
export const canReview = () => ['owner', 'admin', 'reviewer'].includes(currentSession('staff')?.staff_role ?? '')
export const canManage = () => ['owner', 'admin'].includes(currentSession('staff')?.staff_role ?? '')

// ---------------------------------------------------------------- overview
interface MetricValue { value: number | null; previous: number | null }
interface Overview {
  range: { from: string; to: string; days: number }
  verifications: MetricValue
  pass_rate: MetricValue
  completion_seconds: MetricValue
  awaiting_review: { count: number; oldest_at: string | null }
  series: { granularity: 'day' | 'week'; points: Array<{ date: string; verifications: number; passed: number; failed: number }> }
  outcomes: Array<{ key: string; count: number; share: number | null }>
  decline_reasons: Array<{ key: string; count: number }>
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export async function adminOverview(days = 14) {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * 86400000)
  const [m, queue] = await Promise.all([
    call<Overview>(`/console/metrics/overview?from=${isoDay(from)}&to=${isoDay(to)}`),
    reviewQueue(),
  ])
  return {
    days: m.range.days,
    verifications: m.verifications,
    passRate: m.pass_rate,
    completionSeconds: m.completion_seconds,
    awaiting: m.awaiting_review,
    series: m.series.points.map(p => ({
      label: new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      passed: p.passed,
      failed: p.failed,
      other: Math.max(0, p.verifications - p.passed - p.failed),
    })),
    outcomes: m.outcomes,
    topReasons: m.decline_reasons.map(r => [r.key, r.count] as [string, number]),
    oldest: queue.slice(0, 5),
  }
}

// ---------------------------------------------------------------- verifications
export async function adminVerifications(opts: { status?: VerificationStatus | 'all'; q?: string; client?: string; page?: number } = {}) {
  const p = new URLSearchParams({ page_size: '50', page: String(opts.page ?? 1) })
  if (opts.status && opts.status !== 'all') p.set('status', opts.status)
  if (opts.q?.trim()) p.set('q', opts.q.trim())
  if (opts.client) p.set('client_id', opts.client)
  const list = await call<SummaryList>(`/console/verifications?${p}`)
  const counts = list.status_counts
  return {
    rows: list.items.map(fromSummary),
    counts: { ...counts, all: Object.values(counts).reduce((a, b) => a + b, 0) } as Record<string, number>,
    total: list.total,
    page: list.page,
    pageSize: list.page_size,
  }
}

/** Waiting for a decision, the longest-waiting first. */
export async function reviewQueue(): Promise<Verification[]> {
  const list = await call<SummaryList>('/console/verifications?status=needs_review&page_size=100')
  const at = (v: Verification) => +new Date(v.completed_at ?? v.created_at)
  return list.items.map(fromSummary).sort((a, b) => at(a) - at(b))
}

export async function getStaffVerification(id: string): Promise<Verification> {
  const d = await call<Detail>(`/console/verifications/${encodeURIComponent(id)}`)
  return fromDetail(d, await evidenceOf(d, `/console/verifications/${encodeURIComponent(d.id)}/files`, token()))
}

export type Decision = 'approved' | 'declined' | 'redo'

/** Records a reviewer's decision. A redo reopens the link for `steps`, and returns it. */
export async function decide(id: string, action: Decision, note: string, steps: string[] = []) {
  if (action === 'declined' && !note.trim()) throw new ApiError(422, 'Say why it is declined.')
  if (action === 'redo' && !steps.length) throw new ApiError(422, 'Choose at least one step to redo.')
  const path = `/console/verifications/${encodeURIComponent(id)}`
  const body = { note: note.trim() || undefined }
  const res = await call<{ status: string; session_url?: string | null }>(
    action === 'approved' ? `${path}/approve` : action === 'declined' ? `${path}/decline` : `${path}/redo`,
    { body: action === 'redo' ? { ...body, steps } : body },
  )
  changed()
  return res
}

/** The PDF report, downloaded with the staff sign-in. */
export async function downloadStaffReport(id: string, reference: string) {
  const res = await fetch(`${API}/v1/console/verifications/${encodeURIComponent(id)}/report`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new ApiError(res.status, 'The report could not be made. Try again in a moment.')
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${reference}.pdf`
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ---------------------------------------------------------------- clients
interface ClientRow {
  id: string; name: string; email: string; phone: string; country: string; status: 'active' | 'suspended'
  created_at: string; last_login_at: string | null; verifications: number; passed: number; failed: number
  needs_review: number; last_verification_at: string | null; active_keys: number; role: string | null; plan: string
}
interface ClientList {
  items: ClientRow[]; total: number
  overview: { clients: number; active: number; suspended: number; active_keys: number; verifications: number; staff: number }
}

export async function listClients(opts: { q?: string; status?: 'all' | Client['status'] } = {}) {
  const p = new URLSearchParams({ page_size: '100', role: 'client' })
  if (opts.q?.trim()) p.set('q', opts.q.trim())
  if (opts.status && opts.status !== 'all') p.set('status', opts.status)
  const list = await call<ClientList>(`/console/clients?${p}`)
  return {
    overview: list.overview,
    total: list.total,
    rows: list.items.map((c): Client => {
      const decided = c.passed + c.failed + c.needs_review
      return {
        id: c.id, name: c.name, email: c.email, phone: c.phone, country: c.country, plan: c.plan, status: c.status,
        created_at: c.created_at, last_login_at: c.last_login_at ?? undefined,
        verifications: c.verifications, passRate: decided ? c.passed / decided : undefined, keys: c.active_keys,
      }
    }),
  }
}

export async function setClientStatus(id: string, status: Client['status'], reason?: string) {
  await call(`/console/clients/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, reason: reason?.trim() || undefined } })
  changed()
}
