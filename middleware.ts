import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

/**
 * Two jobs, in order:
 *
 *   1. Retire the old locale prefixes — `/ar/albums` and `/en/albums` both
 *      redirect to `/albums`. The site was briefly bilingual and is now
 *      Arabic only; anything already linked or indexed must not break.
 *   2. Role guards — /admin admin-only, /studio creator-or-admin,
 *      /account any authenticated user.
 *
 * Guards live here so an unauthorised request never reaches a route handler.
 * Route-group layouts repeat the check as defence in depth: middleware is the
 * gate, the layout is the lock.
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl

  // ── 1. Legacy locale prefixes ─────────────────────────────────────────────
  const legacy = pathname.match(/^\/(ar|en)(\/.*)?$/)
  if (legacy) {
    const url = request.nextUrl.clone()
    url.pathname = legacy[2] ?? '/'
    // Permanent, and 308 rather than 301 so a POST keeps its method.
    return NextResponse.redirect(url, 308)
  }

  // ── 2. Guards ─────────────────────────────────────────────────────────────
  const user = request.auth?.user
  const required = requiredAccess(pathname)

  if (required) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`
      return NextResponse.redirect(url)
    }
    if (required !== 'authenticated' && !required.includes(user.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/forbidden'
      url.search = ''
      // Rewrite, not redirect: the URL the user typed stays in the address bar
      // so they can hand it to someone who does have the role.
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
})

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
