/**
 * Signing in as a creator or admin for the browser gates.
 *
 * Two-factor is mandatory for both roles (lib/two-factor.ts), and the seeded
 * demo accounts are enrolled (prisma/seed.ts). A gate therefore signs in the
 * way a person does: email + password, and — when the form asks for it — the
 * current 6-digit code, generated from the account's secret in the database.
 * No bypass: the server under test runs exactly the production rule.
 *
 * Plain JS so the .mjs gates can use it as well as the tsx ones. The TOTP maths
 * mirrors lib/totp.ts (RFC 6238, SHA-1, 6 digits, 30 s).
 */
import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input) {
  let bits = 0
  let value = 0
  const bytes = []
  for (const char of input.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** The code an authenticator shows right now for this secret. */
export function totpNow(secret, atMs = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 30_000)))
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(binary).padStart(6, '0')
}

/**
 * The current code for an account, or null when it has not enrolled. A client
 * per call, closed at once: a gate signs in a handful of times, and a client
 * left open would keep a plain-node gate from exiting.
 */
export async function codeFor(email) {
  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })
    return user?.twoFactorEnabled && user.twoFactorSecret ? totpNow(user.twoFactorSecret) : null
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Fill the /sign-in form on `page` (already there) and answer the second step
 * if it appears. Resolves once the form has been submitted for the last time;
 * the caller waits for navigation as before.
 */
export async function submitSignIn(page, email, password) {
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  const code = await codeFor(email)
  if (!code) return
  const field = page.locator('input[name="totp"]')
  await field.waitFor({ state: 'visible', timeout: 20_000 })
  await field.fill(code)
  await page.click('button[type="submit"]')
}

