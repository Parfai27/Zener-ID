// Shapes mirror kyc-backend's schemas (app/schemas/verification.py, console.py)
// as the dashboards use them. client.ts and admin.ts map the backend's onto these.

/** VerificationStatus in app/db/models.py — Shufti's event vocabulary. */
export type VerificationStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'needs_review' | 'expired'

/** CheckStatus / StepStatus in the backend. */
export type CheckStatus = 'pass' | 'fail' | 'review' | 'skipped' | 'pending'

export type DocumentType = 'passport' | 'id_card' | 'driving_license'

export type CheckName = 'document' | 'name' | 'date_of_birth' | 'liveness' | 'face_match'

export interface Check {
  /** One of the five familiar checks, or another step (address, aml...). */
  name: CheckName | string
  /** Shown instead of the name, for a step that is not one of the five. */
  label?: string
  status: CheckStatus
  /** Reason codes, e.g. FACE_MISMATCH, DOCUMENT_EXPIRED. */
  reasons: string[]
  warnings: string[]
  /** One-line human summary shown next to the result word. */
  summary: string
  score?: number
  threshold?: number
}

export interface Applicant {
  first_name: string
  last_name: string
  date_of_birth: string // YYYY-MM-DD
  email?: string
  country?: string
}

export interface ExtractedDocument {
  document_type: DocumentType
  /** The backend gives only the last four characters, e.g. "•••• 4821". */
  number: string
  nationality: string
  /** The backend reads one full name; surname and given names are kept for documents read in parts. */
  full_name?: string
  surname?: string
  given_names?: string
  issuing_country?: string
  date_of_birth: string
  expiry_date: string
  mrz_valid?: boolean
  /** The document step's own decision (pass, fail, review). */
  decision?: string
}

export interface EvidenceFile {
  id: string
  kind: 'document_front' | 'document_back' | 'portrait' | 'selfie'
  name: string
  size_kb: number
  /** A blob: URL of the file, fetched with the sign-in. */
  url?: string
}

export interface ReviewEvent {
  at: string
  by: string
  action: 'approved' | 'declined' | 'redo'
  note: string
}

export interface Verification {
  id: string
  reference: string
  customer_id?: string
  client_id: string
  client_name: string
  status: VerificationStatus
  applicant: Applicant
  services: string[]
  session_token: string
  session_url: string
  document_type?: DocumentType
  checks: Check[]
  reasons: string[]
  document?: ExtractedDocument
  evidence: EvidenceFile[]
  liveness_attempts: number
  reviews: ReviewEvent[]
  created_at: string
  started_at?: string
  completed_at?: string
  expires_at: string
  decision_seconds?: number
}

export interface CreateVerificationRequest {
  applicant: Applicant
  reference?: string
  ttl_days?: number
  document_types?: DocumentType[]
}

/** SessionResponse: what the applicant's browser is allowed to see. Deliberately
 *  thin (no client name, no applicant name): anyone holding the link sees it. */
export interface SessionView {
  reference: string
  status: VerificationStatus
  services: string[]
  /** 'other' is a step this page does not handle (address, questionnaire). */
  next_step: 'document' | 'face' | 'done' | 'other'
  other_step?: string
  completed_steps: string[]
  expired: boolean
  expires_at: string
  document_types: DocumentType[]
  /** Where the company asked for the person to be sent when they finish, if anywhere. */
  redirect_url: string | null
}

export interface QualityReport {
  sharpness: number
  brightness: number
  width: number
  height: number
  ok: boolean
  problems: Array<'blur' | 'dark' | 'bright' | 'small'>
}

export interface DocumentStepResult {
  status: 'pass' | 'retake' | 'fail'
  quality: QualityReport
  message: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at?: string
  revoked: boolean
  expires_at?: string
  /** active, expiring, suspended, expired or revoked. */
  state?: string
}

export interface CreatedApiKey extends ApiKey {
  /** Only ever returned once, like the backend's CreatedApiKeyResponse. */
  secret: string
}

export interface Client {
  id: string
  name: string
  email: string
  /** The billing plan: free, payg or enterprise. */
  plan: string
  status: 'active' | 'suspended'
  created_at: string
  last_login_at?: string
  phone?: string
  country?: string
  verifications: number
  /** Passed out of those decided; undefined when none is. */
  passRate?: number
  /** API keys neither revoked nor expired. */
  keys: number
}

export interface Session {
  role: 'client' | 'staff'
  name: string
  email: string
  client_id?: string
  /** Staff only: the console role (owner, admin, reviewer, support, readonly). */
  staff_role?: string
}

/** Sandbox outcomes the tester can force from the applicant page. */
export type SandboxOutcome =
  | 'auto'
  | 'pass'
  | 'face_mismatch'
  | 'face_borderline'
  | 'liveness_fail'
  | 'name_mismatch'
  | 'dob_mismatch'
  | 'expired_document'
  | 'underage'
  | 'blurry_once'
