import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { isMailConfigured } from '@/lib/mail'
import { enqueue, drainSoon } from '@/lib/outbox'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locale'
import { siteUrl } from '@/lib/site'

/**
 * «نسيت كلمة المرور؟» — the email rail's way back in.
 *
 * ── What the reader can learn from it: nothing ──────────────────────────────
 * `requestPasswordReset` answers every request the same way, known address or
 * not, rate-limited or not. The difference lives only in whether a
 * `PasswordResetToken` and an `auth.passwordReset` outbox row were written.
 *
 * ── The token ───────────────────────────────────────────────────────────────
 * 32 random bytes, base64url. Only its SHA-256 is stored (a slow hash buys
 * nothing against 256 bits of entropy, and SHA-256 lets the lookup be an index
 * hit). 30-minute expiry, single use (`usedAt`), one live token per account —
 * a new request burns the older ones — and a completed reset burns every other
 * token the account still holds.
 *
 * ── Sessions ────────────────────────────────────────────────────────────────
 * Sessions are JWTs, so there is no row to delete. A reset stamps
 * `User.passwordChangedAt`; the `jwt` callback in `lib/auth.ts` refuses any
 * token minted before that instant. 2FA is untouched: the next sign-in still
 * asks for the authenticator code.
 *
 * ── No SMS rail ─────────────────────────────────────────────────────────────
 * `lib/otp.ts` has no SMS provider wired, so there is no "reset by code"
 * option. A phone-only account signs in with an OTP and needs no password.
 */

export const RESET_TTL_MINUTES = 30
/** Requests per address per hour. Counted whether or not the address exists. */
export const RESET_LIMIT_PER_EMAIL = 3
/** Requests per client IP per hour — the brake on sweeping many addresses. */
export const RESET_LIMIT_PER_IP = 10
const WINDOW_MS = 60 * 60 * 1000

/** Same rule as sign-up and the email rail's `authorize`. */
export const PASSWORD_MIN = 8

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export type ResetRequestOutcome = {
  /**
   * Development only — never in production, never with a mail provider. The
   * link a developer would otherwise dig out of the server console, returned
   * the way `issueOtp` returns `devCode`.
   */
  devLink: string | null
  /** For logs and the gate. The page never shows it. */
  outcome: 'queued' | 'unknown' | 'rate_limited'
}

/**
 * Record the request, apply the limits, and — if the address belongs to an
 * active account — queue a reset link in the account's own language.
 */
export async function requestPasswordReset(input: {
  email: string
  ip: string | null
  /** The language of the page the request came from — used for the link. */
  pageLocale: Locale
}): Promise<ResetRequestOutcome> {
  const email = input.email.trim().toLowerCase()
  const emailHash = sha256(`email:${email}`)
  const ipHash = sha256(`ip:${input.ip || 'unknown'}`)
  const since = new Date(Date.now() - WINDOW_MS)

  // Recorded first, so a flood keeps itself limited rather than resetting
  // the window every time it is refused.
  await db.passwordResetRequest.create({ data: { emailHash, ipHash } })

  const [byEmail, byIp] = await Promise.all([
    db.passwordResetRequest.count({ where: { emailHash, createdAt: { gt: since } } }),
    db.passwordResetRequest.count({ where: { ipHash, createdAt: { gt: since } } }),
  ])
  if (byEmail > RESET_LIMIT_PER_EMAIL || byIp > RESET_LIMIT_PER_IP) {
    return { devLink: null, outcome: 'rate_limited' }
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, locale: true, status: true },
  })
  if (!user?.email || user.status === 'suspended') return { devLink: null, outcome: 'unknown' }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000)

  // The account's language, frozen now (see lib/outbox.ts). Arabic is the
  // fallback, never a blank.
  const locale: Locale = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE
  const resetUrl = siteUrl(`/reset-password?token=${token}`, locale)

  await db.$transaction(async (tx) => {
    // One live link per account: an older one stops working the moment a
    // newer one is asked for.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt },
    })
    await enqueue(tx, {
      template: 'auth.passwordReset',
      toEmail: user.email!,
      locale,
      payload: {
        name: user.name ?? '',
        resetUrl,
        minutes: RESET_TTL_MINUTES,
        // Read by the drain: a link that died in the queue is never sent,
        // and a sent one is scrubbed from the row.
        expiresAt: expiresAt.toISOString(),
      },
    })
  })
  drainSoon()

  const devLink =
    process.env.NODE_ENV !== 'production' && !isMailConfigured()
      ? siteUrl(`/reset-password?token=${token}`, input.pageLocale)
      : null
  if (devLink) console.info(`[password-reset] ${email} → ${devLink} (no mail provider configured)`)

  return { devLink, outcome: 'queued' }
}

/** Is this token still redeemable? Read-only — the page uses it to pick a state. */
export async function isResetTokenLive(token: string) {
  if (!token) return false
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { usedAt: true, expiresAt: true, user: { select: { status: true } } },
  })
  return Boolean(row && !row.usedAt && row.expiresAt > new Date() && row.user.status !== 'suspended')
}

export type ResetResult = { ok: true } | { ok: false; reason: 'invalid_token' | 'weak_password' }

/**
 * Redeem a token and set the new password.
 *
 * The token is claimed with a compare-and-set on `usedAt`, so two submissions
 * of the same link cannot both succeed. Then, in one transaction: the new hash,
 * `passwordChangedAt` (which signs out every existing session), and every
 * other live token for the account burned.
 */
export async function resetPassword(token: string, password: string): Promise<ResetResult> {
  if (password.length < PASSWORD_MIN) return { ok: false, reason: 'weak_password' }
  if (!token) return { ok: false, reason: 'invalid_token' }

  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, userId: true, user: { select: { status: true } } },
  })
  if (!row || row.user.status === 'suspended') return { ok: false, reason: 'invalid_token' }

  const now = new Date()
  const claimed = await db.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  })
  if (claimed.count === 0) return { ok: false, reason: 'invalid_token' }

  const passwordHash = await hashPassword(password)
  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    }),
    db.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    }),
  ])

  return { ok: true }
}
