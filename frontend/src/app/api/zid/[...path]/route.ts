import { NextResponse, type NextRequest } from 'next/server'

import { BACKEND_URL, SESSION_COOKIE } from '@/lib/session'

// The browser's way to the backend: /api/zid/<path> -> BACKEND_URL/v1/<path>,
// with the session cookie turned into a bearer token. Only what the company
// dashboard needs is passed through; the backend scopes every answer to the
// signed-in company on its own.
const ALLOWED: { method: string; pattern: RegExp }[] = [
  { method: 'GET', pattern: /^auth\/me$/ },
  { method: 'GET', pattern: /^auth\/callback-secret$/ },
  { method: 'GET', pattern: /^api-keys$/ },
  { method: 'POST', pattern: /^api-keys$/ },
  { method: 'POST', pattern: /^api-keys\/[^/]+\/revoke$/ },
  { method: 'DELETE', pattern: /^api-keys\/[^/]+$/ },
  { method: 'GET', pattern: /^metrics\/(overview|analytics)$/ },
  { method: 'GET', pattern: /^verifications$/ },
  { method: 'POST', pattern: /^verifications$/ },
  { method: 'POST', pattern: /^verifications\/[^/]+\/send$/ },
  { method: 'GET', pattern: /^verifications\/[^/]+$/ },
  { method: 'GET', pattern: /^verifications\/[^/]+\/report$/ },
  { method: 'GET', pattern: /^verifications\/[^/]+\/files\/[a-z_]+$/ },
  { method: 'GET', pattern: /^verifications\/[^/]+\/evidence\/\d+(\/thumbnail)?$/ },
]

const PASSED_HEADERS = ['content-type', 'content-disposition', 'content-length']

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const joined = path.map(encodeURIComponent).join('/')
  const plain = path.join('/')

  if (!ALLOWED.some((a) => a.method === request.method && a.pattern.test(plain))) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ detail: 'Sign in first' }, { status: 401 })

  const target = `${BACKEND_URL}/v1/${joined}${request.nextUrl.search}`
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  const contentType = request.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType

  let res: Response
  try {
    res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.text(),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ detail: 'Cannot reach the Zener ID backend. Is it running?' }, { status: 503 })
  }

  const out = new NextResponse(res.body, { status: res.status })
  for (const name of PASSED_HEADERS) {
    const value = res.headers.get(name)
    if (value) out.headers.set(name, value)
  }
  // Evidence and reports are personal data: never cached on the way.
  out.headers.set('Cache-Control', 'no-store')
  if (res.status === 401) out.cookies.delete(SESSION_COOKIE)
  return out
}

export const GET = proxy
export const POST = proxy
export const DELETE = proxy
