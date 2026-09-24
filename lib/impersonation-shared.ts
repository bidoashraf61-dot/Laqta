/**
 * View-as-user — the edge-safe half.
 *
 * Imported by `middleware.ts` (edge runtime) and `lib/auth.config.ts`, so it
 * holds constants and pure token arithmetic only: no Prisma, no Node APIs.
 * The database half — starting, ending and closing rows — is
 * `lib/impersonation.ts`.
 *
 * ── How a view works ────────────────────────────────────────────────────────
 * The session is a JWT. Starting a view SWAPS the identity in that token to
 * the target user and parks the admin's own identity inside it (`imp.admin`),
 * so every existing page — the library, purchases, the account hub — renders
 * exactly what the customer sees without a single page knowing about it.
 * Ending (or the clock running out) swaps it back.
 *
 * ── Read-only, three layers deep ────────────────────────────────────────────
 *   1. `middleware.ts` refuses every non-GET request while a view is active —
 *      every server action is a POST, so this is every mutation in the app —
 *      plus the GET routes that write (downloads, preview ZIPs, add-to-cart,
 *      certificates, email verification). One exception: the end endpoint.
 *   2. The same middleware stamps `IMPERSONATION_HEADER` on the request, and
 *      `lib/db.ts` refuses any write while it is present, so a GET that writes
 *      and was missed in (1) still cannot change anything.
 *   3. The session's role is the TARGET's (buyer), so `/admin` and every admin
 *      action are out of reach until the view ends.
 */

/** A view ends by itself after this long. */
export const IMPERSONATION_MINUTES = 30

/**
 * Request header meaning "this request belongs to an impersonation". Set (or
 * stripped) by middleware on every request it sees, so a client can never
 * forge its absence; forging its presence only makes their own request
 * read-only.
 */
export const IMPERSONATION_HEADER = 'x-laqta-impersonation'

/** The only non-GET path a view may call: ending itself. */
export const IMPERSONATION_END_PATH = '/api/impersonation/end'

/** GET routes that write or hand out files — refused during a view. */
export const IMPERSONATION_BLOCKED_GET = [
  '/api/download',
  '/api/preview',
  '/cart/add',
  '/account/certificates',
  '/account/verify-email',
]

/** The admin identity parked in the token while a view is active. */
export type ParkedIdentity = {
  uid: string
  role: string
  locale: string
  creatorId: string | null
  name: string | null
  email: string | null
  picture: string | null
}

export type ImpersonationClaim = {
  /** `Impersonation.id` — the audited row. */
  id: string
  /** Epoch milliseconds. */
  expiresAt: number
  targetName: string
  admin: ParkedIdentity
}

type Token = Record<string, unknown> & { imp?: ImpersonationClaim }

/** Swap the admin's identity back in. Mutates and returns the token. */
export function restoreAdmin<T extends object>(input: T): T {
  const token = input as Token
  const imp = token.imp
  if (!imp) return input
  token.uid = imp.admin.uid
  token.sub = imp.admin.uid
  token.role = imp.admin.role
  token.locale = imp.admin.locale
  token.creatorId = imp.admin.creatorId
  token.name = imp.admin.name
  token.email = imp.admin.email
  token.picture = imp.admin.picture
  delete token.imp
  delete token.impersonatedBy
  return input
}

/**
 * Close an expired view on the token alone. Edge-safe, so middleware runs it
 * on every request and the cookie it re-issues already carries the admin
 * again — an expired view cannot outlive its clock by one request.
 */
export function expireIfDue<T extends object>(token: T, now = Date.now()): T {
  const imp = (token as Token).imp
  if (imp && now >= imp.expiresAt) return restoreAdmin(token)
  return token
}
