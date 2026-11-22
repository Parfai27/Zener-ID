import type { VerificationStatus } from './types'

export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'muted'

// The same words the rest of Zener ID uses for each status.
export const statusInfo: Record<VerificationStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: 'Link sent', tone: 'muted', hint: 'The customer has not opened the link yet' },
  in_progress: { label: 'In progress', tone: 'info', hint: 'The customer is completing the steps' },
  needs_review: { label: 'In review', tone: 'warn', hint: 'Our compliance team is checking it' },
  passed: { label: 'Verified', tone: 'ok', hint: 'Identity confirmed' },
  failed: { label: 'Declined', tone: 'bad', hint: 'The checks did not pass' },
  expired: { label: 'Expired', tone: 'muted', hint: 'The link expired before it was finished' },
}

export const documentLabel: Record<string, string> = {
  id_card: 'National ID',
  passport: 'Passport',
  driving_license: 'Driving licence',
}

export const stepLabel: Record<string, string> = {
  document: 'Identity document',
  face: 'Face & liveness',
  aml: 'AML screening',
  address: 'Proof of address',
  due_diligence: 'Due diligence form',
  consent: 'Consent',
}

export const checkLabel: Record<string, string> = {
  liveness: 'Liveness',
  face_match: 'Face match',
  name: 'Name matches',
  date_of_birth: 'Date of birth matches',
  expiry: 'Document not expired',
  mrz: 'Machine-readable zone',
  age: 'Age 18+',
  quality: 'Image quality',
  authenticity: 'Authenticity',
}

const reasonText: Record<string, string> = {
  FACE_MISMATCH: 'The face does not match the document portrait',
  FACE_MATCH_BORDERLINE: 'The face match score is close to the threshold',
  LIVENESS_FAILED: 'No live person was detected (possible photo or screen)',
  NAME_MISMATCH: 'The name on the document does not match the details given',
  NAME_PARTIAL_MATCH: 'The name on the document only partly matches',
  DOB_MISMATCH: 'The date of birth on the document does not match',
  DOCUMENT_EXPIRED: 'The document has expired',
  UNDERAGE: 'The person is under 18',
  NO_FACE_DETECTED: 'No face was found in the capture',
  NO_FACE_ON_DOCUMENT: 'No portrait was found on the document',
  MULTIPLE_FACES_DETECTED: 'More than one face was in view',
  MRZ_CHECKSUM_FAILED: 'The machine-readable zone failed its checksum',
  MRZ_VISUAL_MISMATCH: 'The printed details disagree with the machine-readable zone',
  POSSIBLE_TAMPERING: 'The document shows signs of tampering',
  AI_GENERATED_DECLARED: 'The image declares itself as AI-generated',
  DOCUMENT_TYPE_MISMATCH: 'The document is not the type that was chosen',
}

/** A reason code in words: a known one from the table, any other made readable. */
export function reason(code: string): string {
  if (reasonText[code]) return reasonText[code]
  const words = code.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const words = value.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function dateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function dateOnly(d?: string | null) {
  if (!d) return '—'
  // Plain dates (YYYY-MM-DD) are calendar days, not instants: read them as UTC
  // so a birthday never moves by a day in the viewer's time zone.
  return new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: d.length === 10 ? 'UTC' : undefined,
  })
}

export function timeAgo(d?: string | null) {
  if (!d) return '—'
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return dateOnly(d)
}

export function initials(name: string | null | undefined) {
  if (!name) return '?'
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  )
}

/** A [reference] route param, decoded once whether or not Next already decoded it. */
export function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
