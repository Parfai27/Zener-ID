// The applicant's flow, against the backend. The link's token is the only
// credential: these calls carry no sign-in.
//   GET  /v1/sessions/{token}            where the person is, what comes next
//   POST /v1/sessions/{token}/document   document photos (front, back)
//   POST /v1/face/frame                  one camera frame, for live guidance
//   POST /v1/sessions/{token}/face       liveness frames, the portrait, a short clip
import { ApiError } from './errors'
import { API, request } from './http'
import type { DocumentType, SessionView } from './types'

interface SessionResponse {
  reference: string
  status: SessionView['status']
  services: string[]
  next_step: string | null
  completed_steps: string[]
  expired: boolean
  expires_at: string | null
  document_types: string[] | null
}

const DOCS: DocumentType[] = ['passport', 'id_card', 'driving_license']

export async function getSession(token: string): Promise<SessionView> {
  const s = await request<SessionResponse>(`/sessions/${encodeURIComponent(token)}`)
  const next: SessionView['next_step'] =
    s.next_step === 'document' || s.next_step === 'face' ? s.next_step
      // AML runs on the server by itself; nothing more for the person to do.
      : s.next_step === null || s.next_step === 'aml' ? 'done'
        : 'other'
  return {
    reference: s.reference,
    status: s.status,
    services: s.services,
    next_step: next,
    other_step: next === 'other' ? s.next_step ?? undefined : undefined,
    completed_steps: s.completed_steps,
    expired: s.expired,
    expires_at: s.expires_at ?? '',
    document_types: (s.document_types?.filter(d => DOCS.includes(d as DocumentType)) as DocumentType[] | undefined) ?? DOCS,
  }
}

/** Multipart upload: the backend's step endpoints take files, not JSON. */
async function upload<T>(path: string, form: FormData, timeoutMs?: number): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/v1${path}`, { method: 'POST', body: form, signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail
    throw new ApiError(res.status, typeof detail === 'string' ? detail : 'Something went wrong. Try again in a moment.')
  }
  return data as T
}

const blobOf = async (dataUrl: string) => (await fetch(dataUrl)).blob()

export type StepDecision = 'pass' | 'review' | 'fail' | 'retake'

export async function submitDocument(token: string, input: { document_type: DocumentType; front: string; back?: string }) {
  const form = new FormData()
  form.append('document_type', input.document_type)
  form.append('front', await blobOf(input.front), 'front.jpg')
  if (input.back) form.append('back', await blobOf(input.back), 'back.jpg')
  return upload<{ decision: StepDecision; reasons: string[]; warnings: string[]; portrait: string | null }>(
    `/sessions/${encodeURIComponent(token)}/document`, form,
  )
}

/** What one camera frame looks like to the server: usable, and which way the head points. */
export interface FrameProbe {
  usable: boolean
  faces: number
  yaw: number | null
  pitch: number | null
  direction: 'up' | 'down' | 'left' | 'right' | 'centre' | null
  hints: string[]
}

export async function probeFrame(token: string, frame: Blob, calibrate = false): Promise<FrameProbe> {
  const form = new FormData()
  form.append('frame', frame, 'frame.jpg')
  // The resting pose learned while calibrating is kept against the token, and the
  // face step measures every movement from it.
  form.append('verification_id', token)
  if (calibrate) form.append('calibrate', 'true')
  // A frame that takes this long is no use for live guidance: give up and try the next.
  return upload<FrameProbe>('/face/frame', form, 15000)
}

export async function submitFace(token: string, input: {
  frames: Blob[]; portrait: Blob | null; video: Blob | null; challenge: string; steps: Array<{ index: number; step: string }>
}) {
  const form = new FormData()
  input.frames.forEach((b, i) => form.append('frames', b, `frame_${i}.jpg`))
  if (input.portrait) form.append('portrait', input.portrait, 'portrait.jpg')
  // The clip is evidence only; one in a format the backend does not keep is left out
  // rather than costing the person their check.
  const videoType = input.video?.type.split(';')[0]
  if (input.video?.size && videoType && ['video/webm', 'video/mp4', 'video/quicktime'].includes(videoType)) {
    form.append('video', new Blob([input.video], { type: videoType }), videoType === 'video/mp4' ? 'challenge.mp4' : 'challenge.webm')
  }
  form.append('challenge', input.challenge)
  form.append('steps', JSON.stringify(input.steps))
  return upload<{ decision: StepDecision; reasons: string[]; verification_status: SessionView['status'] }>(
    `/sessions/${encodeURIComponent(token)}/face`, form,
  )
}

/** The QR code for this link, drawn by the backend from the address the page was opened on. */
export const sessionQr = (token: string) => `${API}/verify/${encodeURIComponent(token)}/qr.svg`
