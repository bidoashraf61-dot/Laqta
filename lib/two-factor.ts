/**
 * Mandatory two-factor for creator and admin — the edge-safe half.
 *
 * Imported by `middleware.ts` (edge runtime), so it holds constants and pure
 * functions only: no Prisma, no node:crypto. The TOTP arithmetic itself is
 * `lib/totp.ts`; enrolment is `/account/security`.
 *
 * ── How it is enforced ──────────────────────────────────────────────────────
 * The session carries `twoFactorEnabled`, stamped at sign-in and re-read from
 * the database on every server-side `auth()` (lib/auth.ts). A creator or admin
 * whose account has not enrolled is sent from `/admin/*` and `/studio/*` to
 * the enrolment page, in three places:
 *
 *   1. `middleware.ts` — the gate, on the cookie's claim. It acts only on an
 *      explicit `false`: a cookie minted before this rule has no claim and is
 *      left to (2), which reads the database.
 *   2. The `(admin)` and `(studio)` layouts — the lock, on the fresh value.
 *   3. `requireRole()` and `studioActor()` — every admin/studio server action
 *      and upload route, so a forged POST cannot skip the page.
 *
 * `/account/*` stays open — that is where enrolment happens — and so does
 * sign-out (`/api/auth/*` is outside middleware).
 */

/** Roles for which 2FA is mandatory, per Brief 01 §5. */
export const TWO_FACTOR_REQUIRED_ROLES = ['creator', 'admin'] as const

export function twoFactorRequired(role: string | undefined | null) {
  return (TWO_FACTOR_REQUIRED_ROLES as readonly string[]).includes(role ?? '')
}

/** The page an unenrolled creator or admin is sent to. Locale-free. */
export const TWO_FACTOR_ENROL_PATH = '/account/security'

/**
 * True when this session belongs to a creator or admin who has not enrolled.
 * `twoFactorEnabled` undefined means "unknown" (a cookie older than the claim)
 * and is only treated as owed where the caller has read the database.
 */
export function twoFactorOwed(user: { role?: string | null; twoFactorEnabled?: boolean | null } | null | undefined) {
  if (!user || !twoFactorRequired(user.role)) return false
  return user.twoFactorEnabled !== true
}

/**
 * Where enrolment sends the user back to. Same-site dashboard paths only —
 * `next` comes from the query string, and an open redirect here would put a
 * phishing link behind the security page.
 */
export function safeDashboardReturn(next: string | null | undefined) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  const bare = next.replace(/^\/en(?=\/|$)/, '') || '/'
  const path = bare.split(/[?#]/)[0]
  const dashboard = ['/admin', '/studio'].some((root) => path === root || path.startsWith(`${root}/`))
  return dashboard ? next : null
}

/** The enrolment URL, in the reader's language, remembering where they were going. */
export function enrolmentUrl(locale: string, next: string) {
  const path = locale === 'en' ? `/en${TWO_FACTOR_ENROL_PATH}` : TWO_FACTOR_ENROL_PATH
  return `${path}?next=${encodeURIComponent(next)}`
}
