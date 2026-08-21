import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

/**
 * Email delivery, and the tokens that ride on it.
 *
 * ── An honest local driver, like SMS and payments and storage ───────────────
 * No provider is wired yet. Rather than pretend otherwise, `sendMail` logs the
 * message — including the link — to the SERVER console and reports that it did
 * not deliver, exactly as `lib/otp.ts` does for SMS. The caller can then tell
 * the reader the truth, and a developer can still complete the flow locally by
 * reading the console.
 *
 * The alternative — a silent no-op returning success — produces the worst
 * possible failure: a screen that says "check your inbox" for a message that
 * was never sent, and a support ticket nobody can reproduce.
 */
export type Attachment = { filename: string; content: Buffer }

export async function sendMail(
  to: string,
  subject: string,
  body: string,
  attachments: Attachment[] = [],
) {
  if (!process.env.MAIL_PROVIDER || !process.env.MAIL_API_KEY) {
    const files = attachments.length ? `\n(+${attachments.length} attachment(s))` : ''
    console.info(`[mail] to ${to} — ${subject}\n${body}${files}\n(no mail provider configured)`)
    return false
  }
  // Provider integration lands with the payments/SMS vendor selection.
  throw new Error(`Mail provider "${process.env.MAIL_PROVIDER}" is not implemented yet`)
}

/** Long enough that guessing is not a strategy. */
const TOKEN_BYTES = 32
const TOKEN_TTL_MINUTES = 30

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * The identifier binds a token to BOTH the account and the address it is
 * proving. Without the address in the key, a token issued for one email could
 * be redeemed after the user had changed it to another — verifying an address
 * nobody ever confirmed.
 */
const identifierFor = (userId: string, email: string) => `${userId}:${email.toLowerCase()}`

/**
 * Issue a fresh email-verification token and send the link.
 *
 * Returns the link when delivery did not happen, so a development caller can
 * surface it. It is never returned once a provider is configured.
 */
export async function issueEmailVerification(userId: string, email: string, origin: string) {
  const identifier = identifierFor(userId, email)

  // One live token per address: issuing a new one invalidates the last, so a
  // link from an older attempt cannot be replayed.
  await db.verificationToken.deleteMany({ where: { identifier } })

  const token = randomBytes(TOKEN_BYTES).toString('hex')
  await db.verificationToken.create({
    data: {
      identifier,
      token: hash(token),
      expires: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
    },
  })

  const link = `${origin}/account/verify-email?token=${token}`

  /*
   * Sent directly rather than queued, deliberately.
   *
   * The outbox exists so a mail failure cannot roll back a purchase. Here the
   * mail IS the operation — there is no transaction to protect and nothing to
   * undo — and the caller shows the reader the outcome immediately, including
   * the development link when no provider is configured. Queuing would put a
   * drain between the click and that answer for no gain.
   */
  const delivered = await sendMail(
    email,
    'تأكيد بريدك الإلكتروني — لقطة',
    `لتأكيد بريدك الإلكتروني، افتح الرابط التالي خلال ${TOKEN_TTL_MINUTES} دقيقة:\n\n${link}`,
  )

  return { delivered, devLink: delivered ? null : link }
}

/**
 * Redeem a token. Returns the user it verified, or null.
 *
 * Deletes the token whatever the outcome of the expiry check, so a leaked link
 * is single-use even if it arrives late.
 */
export async function consumeEmailVerification(token: string) {
  const row = await db.verificationToken.findUnique({ where: { token: hash(token) } })
  if (!row) return null

  await db.verificationToken.delete({ where: { token: row.token } })
  if (row.expires < new Date()) return null

  const [userId, email] = row.identifier.split(':')
  if (!userId || !email) return null

  // The address must still be the one on the account. If it changed after the
  // link was sent, the link proves nothing about the current address.
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user || user.email?.toLowerCase() !== email) return null

  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } })
  return { userId, email }
}

/** Whether a provider is wired. Surfaced on /admin/settings beside storage. */
export const mailConfigured = Boolean(process.env.MAIL_PROVIDER && process.env.MAIL_API_KEY)
