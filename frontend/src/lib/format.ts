import type { CheckName, CheckStatus, DocumentType, VerificationStatus } from '../api/types'

export const statusInfo: Record<VerificationStatus, { label: string; tone: 'ok' | 'bad' | 'warn' | 'muted' | 'info' }> = {
  passed: { label: 'Verified', tone: 'ok' },
  failed: { label: 'Declined', tone: 'bad' },
  needs_review: { label: 'Needs review', tone: 'warn' },
  pending: { label: 'Link sent', tone: 'muted' },
  in_progress: { label: 'In progress', tone: 'info' },
  expired: { label: 'Expired', tone: 'muted' },
}

/** Short result words, like the Shufti session card: Match / Pass / Met / Clear. */
export const checkInfo: Record<CheckName, { label: string; ok: string; icon: string }> = {
  document: { label: 'Document', ok: 'Authentic', icon: 'doc' },
  name: { label: 'Name', ok: 'Match', icon: 'name' },
  date_of_birth: { label: 'Date of birth · 18+', ok: 'Met', icon: 'dob' },
  liveness: { label: 'Liveness', ok: 'Pass', icon: 'live' },
  face_match: { label: 'Face match', ok: 'Match', icon: 'face' },
}

export function resultWord(name: CheckName, s: CheckStatus): { word: string; tone: 'ok' | 'bad' | 'warn' | 'muted' } {
  if (s === 'pass') return { word: checkInfo[name].ok, tone: 'ok' }
  if (s === 'fail') return { word: name === 'liveness' ? 'Fail' : name === 'document' ? 'Rejected' : 'Mismatch', tone: 'bad' }
  if (s === 'review') return { word: 'Review', tone: 'warn' }
  return { word: 'Not run', tone: 'muted' }
}

export const reasonText: Record<string, string> = {
  FACE_MISMATCH: 'The face does not match the document portrait',
  FACE_MATCH_BORDERLINE: 'The face match score is close to the threshold',
  LIVENESS_FAILED: 'No live person detected (possible photo or screen)',
  NAME_MISMATCH: 'The name on the document does not match the applicant',
  DOB_MISMATCH: 'The date of birth on the document does not match',
  DOCUMENT_EXPIRED: 'The document has expired',
  UNDERAGE: 'The applicant is under 18',
  IMAGE_BLURRY: 'The document photo was blurry',
}

export const docLabel: Record<DocumentType, string> = { passport: 'Passport', id_card: 'National ID card', driving_license: 'Driving licence' }

export function fullName(a: { first_name: string; last_name: string }) { return `${a.first_name} ${a.last_name}` }
export function initials(s: string) { return s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() }

export function timeAgo(d?: string) {
  if (!d) return '—'
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function dateTime(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function waited(d?: string) {
  if (!d) return '—'
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d`
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`
