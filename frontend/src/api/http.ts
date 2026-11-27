// Talking to the backend: one request helper and how its errors read.
// In development Vite forwards /v1 to the backend (vite.config.ts); VITE_API_URL
// points elsewhere when the API runs on another origin.
import { ApiError } from './errors'

export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** FastAPI answers with {detail: "text"} or, for a refused body, {detail: [{loc, msg}]}. */
function readError(status: number, data: unknown): ApiError {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return new ApiError(status, detail)
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {}
    for (const d of detail as Array<{ loc?: unknown[]; msg?: string }>) {
      const name = String(d.loc?.[d.loc.length - 1] ?? 'form')
      fields[name] ??= String(d.msg ?? 'Not valid.').replace(/^Value error, /, '')
    }
    return new ApiError(status, Object.values(fields)[0] ?? 'Check the form.', fields)
  }
  if (status === 429) return new ApiError(status, 'Too many attempts. Wait a few minutes and try again.')
  return new ApiError(status, 'Something went wrong. Try again in a moment.')
}

export async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/v1${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw readError(res.status, data)
  return data as T
}
