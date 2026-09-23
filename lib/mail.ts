import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

/**
 * Email delivery, and the tokens that ride on it.
 *
 * ── Two drivers ─────────────────────────────────────────────────────────────
 * `resend` — the chosen provider. A plain `fetch` to its REST endpoint rather
 * than the SDK: one POST does not justify a dependency, and a fetch is what
 * `verify:mail` can intercept to check the request shape without a network.
 *
 * The honest local driver — used whenever MAIL_PROVIDER, MAIL_API_KEY and
 * MAIL_FROM are not all set. `sendMail` logs the message — including the link —
 * to the SERVER console and reports that it did not deliver, exactly as
 * `lib/otp.ts` does for SMS. The caller can then tell the reader the truth, and
 * a developer can still complete the flow locally by reading the console.
 *
 * The alternative — a silent no-op returning success — produces the worst
 * possible failure: a screen that says "check your inbox" for a message that
 * was never sent, and a support ticket nobody can reproduce.
 *
 * No key is ever written in code. MAIL_API_KEY comes from the environment only.
 */
export type Attachment = { filename: string; content: Buffer }

export type MailOptions = {
  /** The HTML part. The positional `body` is always sent as the text part. */
  html?: string
  /** Overrides MAIL_REPLY_TO — the contact form replies to its sender. */
  replyTo?: string
  /**
   * Makes a retry of the SAME message a no-op at the provider. The outbox
   * passes its row id: a drain that timed out after Resend had accepted the
   * message would otherwise send it a second time on the next attempt.
   */
  idempotencyKey?: string
}

export const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** Read live, not at import — a gate or a late-set env must be honoured. */
export function isMailConfigured() {
  return Boolean(process.env.MAIL_PROVIDER && process.env.MAIL_API_KEY && process.env.MAIL_FROM)
}

export async function sendMail(
  to: string,
  subject: string,
  body: string,
  attachments: Attachment[] = [],
  options: MailOptions = {},
) {
  if (!isMailConfigured()) {
    const files = attachments.length ? `\n(+${attachments.length} attachment(s))` : ''
    console.info(`[mail] to ${to} — ${subject}\n${body}${files}\n(no mail provider configured)`)
    return false
  }

  const provider = (process.env.MAIL_PROVIDER ?? '').toLowerCase()
  if (provider === 'resend') return sendViaResend(to, subject, body, attachments, options)

  throw new Error(`Mail provider "${process.env.MAIL_PROVIDER}" is not implemented`)
}

/**
 * Resend — https://resend.com/docs/api-reference/emails/send-email
 *
 * Throws on any non-2xx with the status in the message, so the outbox records
 * it as `lastError` and `/admin/settings` can count it. A rejection that names
 * the recipient reads as permanent to the outbox and is parked, not retried.
 */
async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  attachments: Attachment[],
  options: MailOptions,
) {
  const replyTo = options.replyTo || process.env.MAIL_REPLY_TO || undefined
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.MAIL_API_KEY}`,
    'Content-Type': 'application/json',
  }
  // Resend keeps an idempotency key for 24 hours, max 256 characters.
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey.slice(0, 256)

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject,
      text,
      ...(options.html ? { html: options.html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachments.length
        ? {
            attachments: attachments.map((file) => ({
              filename: file.filename,
              content: file.content.toString('base64'),
            })),
          }
        : {}),
    }),
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const payload = (await response.json()) as { message?: string; name?: string }
      detail = [payload.name, payload.message].filter(Boolean).join(': ') || detail
    } catch {
      // Not JSON — keep the status text.
    }
    throw new Error(`resend ${response.status}: ${detail}`.slice(0, 500))
  }
  return true
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
export const mailConfigured = isMailConfigured()
