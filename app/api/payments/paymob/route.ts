import { NextResponse, type NextRequest } from 'next/server'
import { handlePaymobCallback } from '@/lib/paymob-callback'

/**
 * Paymob "transaction processed" callback — the ONLY thing that can mark a
 * card or Apple Pay order paid.
 *
 * Server-to-server: no session, no cookie, no CSRF token. The HMAC in the
 * `hmac` query parameter is the whole of the authentication, and it is checked
 * before anything is read from or written to the database. The middleware
 * matcher excludes `/api/payments` so no auth or locale logic runs in front of
 * it.
 *
 * Responses are bare JSON codes: Paymob reads the status, not the body, and
 * retries on anything that is not 2xx. That is why a recorded-but-not-settled
 * outcome (declined, amount mismatch, …) still answers 200 — it was handled,
 * and retrying would not change the answer.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const hmac = request.nextUrl.searchParams.get('hmac')

  const result = await handlePaymobCallback(body, hmac)
  return NextResponse.json({ outcome: result.outcome }, { status: result.httpStatus })
}

/**
 * Paymob can also be pointed at a URL with GET (the browser "response"
 * callback). That is the buyer's browser, not Paymob's server, and it is never
 * trusted to settle anything — send it to the read-only return page.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/checkout/return'
  return NextResponse.redirect(url, 303)
}
