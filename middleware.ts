import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { LOCALE_HEADER } from '@/lib/locale'

const { auth } = NextAuth(authConfig)

/**
 * Three jobs, in order:
 *
 *   1. Retire the `/ar` prefix — `/ar/albums` redirects to `/albums`. Arabic is
 *      the default and owns the bare path; anything already linked or indexed
 *      under `/ar` must not break.
 *   2. Resolve the locale. `/en/albums` is REWRITTEN to `/albums` with a header
 *      naming the language. The address bar keeps `/en/albums`, so the English
 *      page has its own indexable URL, but the router only ever sees one tree —
 *      no `app/[locale]` segment, no route file that has to exist twice.
 *   3. Role guards — /admin admin-only, /studio creator-or-admin,
 *      /account any authenticated user.
 *
 * Order matters: guards run on the STRIPPED path, so `/en/admin` is guarded
 * exactly as `/admin` is. A locale prefix must never be a way around a role.
 *
 * Guards live here so an unauthorised request never reaches a route handler.
 * Route-group layouts repeat the check as defence in depth: middleware is the
 * gate, the layout is the lock.
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl

  // ── 1. The retired `/ar` prefix ───────────────────────────────────────────
  const arabic = pathname.match(/^\/ar(\/.*)?$/)
  if (arabic) {
    const url = request.nextUrl.clone()
    url.pathname = arabic[1] ?? '/'
    // Permanent, and 308 rather than 301 so a POST keeps its method.
    return NextResponse.redirect(url, 308)
  }

  // ── 2. Locale ─────────────────────────────────────────────────────────────
  const english = pathname.match(/^\/en(\/.*)?$/)
  const routed = english ? (english[1] ?? '/') : pathname
  const locale = english ? 'en' : 'ar'

  // ── 3. Guards, on the routed path ─────────────────────────────────────────
  const user = request.auth?.user
  const required = requiredAccess(routed)

  if (required) {
    if (!user) {
      const url = request.nextUrl.clone()
      // Send them to the sign-in page in the language they were reading, and
      // bring them back to the URL they typed — prefix and all.
      url.pathname = english ? '/en/sign-in' : '/sign-in'
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`
      return NextResponse.redirect(url)
    }
    if (required !== 'authenticated' && !required.includes(user.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/forbidden'
      url.search = ''
      // Rewrite, not redirect: the URL the user typed stays in the address bar
      // so they can hand it to someone who does have the role.
      return rewriteWithLocale(request, url, locale)
    }
  }

  if (english) {
    const url = request.nextUrl.clone()
    url.pathname = routed
    return rewriteWithLocale(request, url, locale)
  }

  return NextResponse.next({ request: { headers: withLocale(request.headers, locale) } })
})

/**
 * The locale travels as a REQUEST header, not a response header — the layout
 * reads it during render, and a response header would arrive far too late.
 */
function withLocale(source: Headers, locale: string): Headers {
  const headers = new Headers(source)
  headers.set(LOCALE_HEADER, locale)
  return headers
}

function rewriteWithLocale(request: { headers: Headers }, url: URL, locale: string) {
  return NextResponse.rewrite(url, {
    request: { headers: withLocale(request.headers, locale) },
  })
}

type Access = 'authenticated' | readonly ('buyer' | 'creator' | 'admin')[]

function requiredAccess(path: string): Access | null {
  if (path === '/admin' || path.startsWith('/admin/')) return ['admin'] as const
  if (path === '/studio' || path.startsWith('/studio/')) return ['creator', 'admin'] as const
  if (path === '/account' || path.startsWith('/account/')) return 'authenticated'
  return null
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the auth API, and static assets.
     * Files with an extension are excluded so /fonts/*.woff2 is untouched.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
