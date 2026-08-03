import NextAuth from 'next-auth'
import { NextResponse, type NextRequest } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { defaultLocale, isLocale, locales } from '@/lib/i18n'

const { auth } = NextAuth(authConfig)

const LOCALE_COOKIE = 'laqta-locale'

/**
 * Two jobs, in order:
 *
 *   1. Locale routing — every path is prefixed `/ar` (default) or `/en`.
 *   2. Role guards    — /admin admin-only, /studio creator-or-admin,
 *                       /account any authenticated user.
 *
 * Guards live here so an unauthorised request never reaches a route handler.
 * Route-group layouts repeat the check as defence in depth; middleware is the
 * gate, the layout is the lock.
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl

  // ── 1. Locale ─────────────────────────────────────────────────────────────
  const segments = pathname.split('/').filter(Boolean)
  const hasLocale = segments.length > 0 && isLocale(segments[0])

  if (!hasLocale) {
    const preferred = resolvePreferredLocale(request)
    const url = request.nextUrl.clone()
    url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(url)
  }

  const locale = segments[0] as (typeof locales)[number]
  const pathWithoutLocale = `/${segments.slice(1).join('/')}`

  // ── 2. Guards ─────────────────────────────────────────────────────────────
  const user = request.auth?.user
  const required = requiredAccess(pathWithoutLocale)

  if (required) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}/sign-in`
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`
      return NextResponse.redirect(url)
    }
    if (required !== 'authenticated' && !required.includes(user.role)) {
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}/forbidden`
      url.search = ''
      return NextResponse.rewrite(url)
    }
  }

  const response = NextResponse.next()
  response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
})

type Access = 'authenticated' | readonly ('buyer' | 'creator' | 'admin')[]

function requiredAccess(path: string): Access | null {
  if (path === '/admin' || path.startsWith('/admin/')) return ['admin'] as const
  if (path === '/studio' || path.startsWith('/studio/')) return ['creator', 'admin'] as const
  if (path === '/account' || path.startsWith('/account/')) return 'authenticated'
  return null
}

function resolvePreferredLocale(request: NextRequest) {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && isLocale(cookie)) return cookie

  // Arabic wins ties — it is the default, not a fallback.
  const header = request.headers.get('accept-language') ?? ''
  if (/\ben\b/i.test(header) && !/\bar\b/i.test(header)) return 'en'
  return defaultLocale
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the auth API, and static assets.
     * Files with an extension are excluded so /fonts/*.woff2 isn't localised.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
