import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

/**
 * SMS providers that actually deliver a code. Empty until one is chosen and
 * built — setting `SMS_PROVIDER` to a name that is not in here does nothing.
 */
const SMS_PROVIDERS: Record<string, (phone: string, code: string, apiKey: string) => Promise<void>> = {}

/**
 * Is the phone rail open?
 *
 * Only when a real provider will deliver the code. Before this switch existed,
 * a missing provider handed the code back to the browser — on a live site that
 * let anyone sign in as any phone number. So there is no "development" way
 * round it: no provider, no phone sign-in, in every environment. Every phone
 * entry point (the `phone` credentials provider, the send-code actions, the
 * sign-in tab) checks this.
 */
export function phoneSignInEnabled() {
  const provider = process.env.SMS_PROVIDER
  return Boolean(provider && process.env.SMS_API_KEY && SMS_PROVIDERS[provider])
}

/**
 * Issue a phone OTP.
 *
 * The code is hashed at rest so a database leak doesn't hand out sessions.
 * Callers check `phoneSignInEnabled()` first. The plain code is returned only
 * outside production and only for the `verify:auth` gate, which exercises the
 * challenge store in-process — no action ever sends it to a browser.
 */
export async function issueOtp(phone: string) {
  const code = String(Math.floor(100_000 + Math.random() * 900_000))
  const codeHash = await bcrypt.hash(code, 10)

  // One live challenge per number.
  await db.phoneOtp.deleteMany({ where: { phone, consumedAt: null } })
  await db.phoneOtp.create({
    data: { phone, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  })

  const delivered = await sendSms(phone, code)
  const devCode = !delivered && process.env.NODE_ENV !== 'production' ? code : null
  return { delivered, devCode }
}

/** Verify and burn a code. Returns false for wrong, expired or exhausted. */
export async function consumeOtp(phone: string, code: string) {
  const challenge = await db.phoneOtp.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!challenge || challenge.attempts >= MAX_ATTEMPTS) return false

  const ok = await bcrypt.compare(code, challenge.codeHash)
  if (!ok) {
    await db.phoneOtp.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    return false
  }

  await db.phoneOtp.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  })
  return true
}

async function sendSms(phone: string, code: string) {
  if (!phoneSignInEnabled()) return false
  await SMS_PROVIDERS[process.env.SMS_PROVIDER!](phone, code, process.env.SMS_API_KEY!)
  return true
}
