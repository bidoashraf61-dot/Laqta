import { NextResponse, type NextRequest } from 'next/server'
import { withNotice } from '@/lib/previews'

/**
 * The refusals both comp routes share.
 *
 * Every refusal has two forms. A control on a page passes `back` (the page
 * it sits on), and a person who clicked it is sent back there — to sign in, or
 * to a notice beside the control — rather than left staring at JSON. A caller
 * without `back` (a script, the gate) gets the status code and a stable error
 * key, the same shape as `/api/download`.
 */

export function unauthenticated(request: NextRequest, back: string | null) {
  if (!back) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const english = /^\/en(?=\/|$)/.test(back)
  const url = new URL(english ? '/en/sign-in' : '/sign-in', request.nextUrl.origin)
  url.searchParams.set('callbackUrl', back)
  return NextResponse.redirect(url, 303)
}

export function unavailable(request: NextRequest, back: string | null) {
  if (!back) return NextResponse.json({ error: 'no_preview' }, { status: 404 })
  return NextResponse.redirect(new URL(withNotice(back, 'unavailable'), request.nextUrl.origin), 303)
}

export function limited(
  request: NextRequest,
  back: string | null,
  grant: { limit: number; windowS: number },
) {
  if (!back) {
    return NextResponse.json(
      { error: 'rate_limited', limit: grant.limit, windowSeconds: grant.windowS },
      { status: 429, headers: { 'Retry-After': String(grant.windowS) } },
    )
  }
  return NextResponse.redirect(new URL(withNotice(back, 'limit'), request.nextUrl.origin), 303)
}

export const NOT_FOUND = () => NextResponse.json({ error: 'not_found' }, { status: 404 })

/** Headers every served comp carries. */
export function fileHeaders(disposition: string, type: string, length: number) {
  return {
    'Content-Type': type,
    'Content-Length': String(length),
    'Content-Disposition': disposition,
    // Per-user and rate-limited: nothing between here and the browser may keep it.
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }
}
