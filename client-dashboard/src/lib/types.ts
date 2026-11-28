// Shapes returned by the Zener ID backend (FastAPI, /v1/...). They mirror
// backend/app/schemas/{auth,console,verification}.py; keep them in step.

export type VerificationStatus =
  | 'pending'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'needs_review'
  | 'expired'

export const STATUSES: VerificationStatus[] = [
  'pending',
  'in_progress',
  'needs_review',
  'passed',
  'failed',
  'expired',
]

export type DocumentType = 'id_card' | 'passport' | 'driving_license'

export interface Account {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  country_code: string
  date_of_birth: string
  country: string
  gender: string | null
  city: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  account: Account
}

export interface Applicant {
  customer_id: string | null
  name: string | null
  email: string | null
  country: string | null
}

export interface VerificationSummary {
  id: string
  reference: string
  status: VerificationStatus
  event: string | null
  services: string[]
  document_type: string | null
  reasons: string[]
  client: { id: string; name: string; email: string }
  applicant: Applicant
  created_at: string
  completed_at: string | null
  expires_at: string | null
}

export interface VerificationList {
  items: VerificationSummary[]
  total: number
  page: number
  page_size: number
  status_counts: Record<VerificationStatus, number>
}

export interface Check {
  name: string
  status: string
  reasons: string[]
  warnings: string[]
}

export interface DetailStep {
  step: string
  attempt: number
  status: string
  reasons: string[]
  warnings: string[]
  extracted: Record<string, unknown>
  checks: Check[]
  match_score: number | null
  match_threshold: number | null
  started_at: string | null
  completed_at: string | null
}

export interface DocumentRead {
  document_type: string
  decision: string
  full_name: string | null
  date_of_birth: string | null
  document_number_last4: string | null
  issuing_country: string | null
  nationality: string | null
  expiry_date: string | null
}

export interface EvidenceFile {
  id: string
  kind: string
  step: string | null
  attempt: number | null
  content_type: string
  byte_size: number
  captured_at: string | null
  created_at: string
}

export interface ReviewEvent {
  action: string
  by: string
  note: string | null
  steps: string[]
  at: string
}

export interface ClaimedDetails {
  first_name?: string
  last_name?: string
  date_of_birth?: string
  country?: string
  email?: string
  phone?: string
  address?: string
}

export interface VerificationDetail {
  id: string
  reference: string
  customer_id: string | null
  status: VerificationStatus
  event: string | null
  services: string[]
  session_url: string
  country: string | null
  language: string | null
  reasons: string[]
  warnings: string[]
  aml: Record<string, unknown> | null
  document_type: string | null
  client: { id: string; name: string; email: string }
  applicant: Applicant
  started_at: string | null
  steps: DetailStep[]
  document: DocumentRead | null
  files: string[]
  evidence: EvidenceFile[]
  reviews: ReviewEvent[]
  claimed: ClaimedDetails
  expires_at: string | null
  created_at: string
  completed_at: string | null
}

export type ApiKeyState = 'active' | 'expiring' | 'suspended' | 'expired' | 'revoked'

export interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  state: ApiKeyState
  created_at: string
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
  suspended_at: string | null
}

export interface ApiKeyList {
  items: ApiKeyRow[]
  total: number
  page: number
  page_size: number
  state_counts: Record<string, number>
}

export interface CreatedApiKey {
  id: string
  name: string
  prefix: string
  key: string
  expires_at: string
  warning: string
}
