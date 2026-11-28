import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE } from '@/lib/session'

// Only a quick gate: no cookie, no dashboard. Whether the token is still good
// is the backend's call, made on the first request the page sends.
export function middleware(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
