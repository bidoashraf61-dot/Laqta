import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { COPY_PREVIEW_HEADER, LOCALE_HEADER } from '@/lib/locale'
import {
  IMPERSONATION_BLOCKED_GET,
  IMPERSONATION_END_PATH,
  IMPERSONATION_HEADER,
} from '@/lib/impersonation-shared'

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

  // ── 3a. View-as-user is read-only ─────────────────────────────────────────
  // Every server action is a POST, so refusing every non-GET here refuses
  // every mutation in the app, whatever button a page forgot to hide. The GET
  // routes that write or hand out files are refused by name. `lib/db.ts`
  // refuses writes again below this, keyed on the header set further down.
  const viewing = Boolean(user?.impersonatedBy)
  if (viewing && routed !== IMPERSONATION_END_PATH && isWrite(request.method, routed)) {
    return readOnlyRefusal(locale)
  }
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
      return rewriteWithLocale(request, url, locale, viewing)
    }
  }

  // ── 4. Copy preview (DEV-64b) ─────────────────────────────────────────────
  // `?copyPreview=<id>` shows unpublished copy — to an admin, never while
  // viewing as someone else. Anyone else gets the published page.
  const copyPreview =
    user?.role === 'admin' && !viewing ? request.nextUrl.searchParams.get('copyPreview') : null

  if (english) {
    const url = request.nextUrl.clone()
    url.pathname = routed
    return rewriteWithLocale(request, url, locale, viewing, copyPreview)
  }

  return NextResponse.next({ request: { headers: withLocale(request.headers, locale, viewing, copyPreview) } })
})

/**
 * The locale travels as a REQUEST header, not a response header — the layout
 * reads it during render, and a response header would arrive far too late.
 */
function withLocale(source: Headers, locale: string, viewing: boolean, copyPreview: string | null = null): Headers {
  const headers = new Headers(source)
  headers.set(LOCALE_HEADER, locale)
  // Always overwritten, never passed through: a client cannot send its own.
  if (viewing) headers.set(IMPERSONATION_HEADER, '1')
  else headers.delete(IMPERSONATION_HEADER)
  // Unpublished copy is shown to an admin only (DEV-64b); same rule.
  if (copyPreview) headers.set(COPY_PREVIEW_HEADER, copyPreview)
  else headers.delete(COPY_PREVIEW_HEADER)
  return headers
}

function rewriteWithLocale(
  request: { headers: Headers },
  url: URL,
  locale: string,
  viewing: boolean,
  copyPreview: string | null = null,
) {
  return NextResponse.rewrite(url, {
    request: { headers: withLocale(request.headers, locale, viewing, copyPreview) },
  })
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function isWrite(method: string, path: string) {
  if (!SAFE_METHODS.has(method.toUpperCase())) return true
  return IMPERSONATION_BLOCKED_GET.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/**
 * The refusal. Plain text in the reader's language — it has to make sense as
 * a whole page (a no-JS form post, a download link) as well as to a server
 * action's fetch, and a 403 is what both should see.
 */
function readOnlyRefusal(locale: string) {
  const body =
    locale === 'en'
      ? 'This action is blocked: you are viewing the site as another user, read-only.'
      : 'هذا الإجراء موقوف: أنت تعرض الموقع كمستخدم آخر للقراءة فقط.'
  return new NextResponse(body, {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-laqta-read-only': '1' },
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
     * Everything except Next internals, the auth API, the payment gateway
     * callbacks, and static assets. Files with an extension are excluded so
     * /fonts/*.woff2 is untouched. `api/payments` is a server-to-server POST
     * authenticated by its HMAC alone; no session or locale logic belongs in
     * front of it. `api/studio` carries upload bodies (a master part is
     * 16 MB+, a release scan up to 15 MB) and Next buffers any body the
     * middleware can see at 10 MB — so those JSON routes check the session
     * themselves (`lib/route-auth.ts#studioActor`) and sit outside.
     */
    '/((?!api/auth|api/payments|api/studio|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
