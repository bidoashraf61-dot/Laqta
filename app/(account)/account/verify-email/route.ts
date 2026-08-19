import { NextResponse, type NextRequest } from 'next/server'
import { consumeEmailVerification } from '@/lib/mail'
import { LOCALE_HEADER } from '@/lib/locale'

/**
 * Redeem an email-verification link.
 *
 * A route handler rather than a page: it performs a side effect and redirects,
 * and it must not be retried or replayed the way a render can be.
 *
 * The outcome travels back as a query flag rather than a message, so the
 * account page renders the sentence in the reader's own language — a redirect
 * cannot carry translated copy, and a English-only "verified!" on an Arabic
 * page would be the exact leak `verify:arabic` exists to catch.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const locale = request.headers.get(LOCALE_HEADER) === 'en' ? 'en' : 'ar'
  const to = (path: string) => new URL(locale === 'en' ? `/en${path}` : path, request.url)

  const target = to('/account')
  // No session check: the token IS the proof, and requiring a sign-in as well
  // would break the common case of opening the link on a different device.
  const result = token ? await consumeEmailVerification(token) : null
  target.searchParams.set('verified', result ? 'email' : 'failed')

  return NextResponse.redirect(target)
}
