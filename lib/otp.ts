import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

/**
 * Issue a phone OTP.
 *
 * The code is hashed at rest so a database leak doesn't hand out sessions.
 * With no SMS provider configured (development) the code is returned so the
 * caller can print it to the server console — never to the client response.
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
  return { delivered, devCode: delivered ? null : code }
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
  if (!process.env.SMS_PROVIDER || !process.env.SMS_API_KEY) {
    // Development: no provider wired. Log and let the caller surface the code.
    console.info(`[otp] ${phone} → ${code} (no SMS provider configured)`)
    return false
  }
  // Provider integration lands with the payments/SMS vendor selection.
  throw new Error(`SMS provider "${process.env.SMS_PROVIDER}" is not implemented yet`)
}
