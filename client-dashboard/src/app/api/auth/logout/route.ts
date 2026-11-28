import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE } from '@/lib/session'

function signedOut(request: NextRequest) {
  const target = new URL('/login', request.url)
  if (request.nextUrl.searchParams.get('expired')) target.searchParams.set('expired', '1')
  const response = NextResponse.redirect(target, 303)
  response.cookies.delete(SESSION_COOKIE)
  return response
}

// GET is used when a server component finds the session expired; POST by the sign-out button.
export const GET = signedOut
export const POST = signedOut
