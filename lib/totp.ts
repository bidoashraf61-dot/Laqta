import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * TOTP (RFC 6238) for creator and admin two-factor.
 *
 * Implemented on node:crypto rather than pulling a library: the algorithm is
 * thirty lines, and an authenticator secret is not something to hand to an
 * unaudited transitive dependency tree.
 *
 * Compatible with Google Authenticator, Authy, 1Password and Microsoft
 * Authenticator: SHA-1, 6 digits, 30-second step — the defaults every
 * authenticator assumes when the otpauth URI omits them.
 */

const DIGITS = 6
const STEP_SECONDS = 30
/** Accept the neighbouring steps: phone clocks drift, and users are slow. */
const WINDOW = 1

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes))
}

/**
 * The URI behind the enrolment QR code. `issuer` shows as the account group in
 * the authenticator; `label` should be the user's email or phone.
 */
export function otpauthUri({
  secret,
  label,
  issuer = 'Laqta',
}: {
  secret: string
  label: string
  issuer?: string
}) {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params}`
}

export function generateToken(secret: string, atMs = Date.now()) {
  return hotp(base32Decode(secret), Math.floor(atMs / 1000 / STEP_SECONDS))
}

/**
 * Verify a user-entered code. Compared with `timingSafeEqual` so a wrong code
 * cannot be walked digit by digit off the response time.
 */
export function verifyToken(secret: string, token: string, atMs = Date.now()) {
  const cleaned = token.replace(/\D/g, '')
  if (cleaned.length !== DIGITS) return false

  const counter = Math.floor(atMs / 1000 / STEP_SECONDS)
  const key = base32Decode(secret)

  for (let drift = -WINDOW; drift <= WINDOW; drift += 1) {
    const candidate = hotp(key, counter + drift)
    const a = Buffer.from(candidate)
    const b = Buffer.from(cleaned)
    if (a.length === b.length && timingSafeEqual(a, b)) return true
  }
  return false
}

/** RFC 4226 dynamic truncation. */
function hotp(key: Buffer, counter: number) {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac('sha1', key).update(counterBuffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

function base32Encode(buffer: Buffer) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(input: string) {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// The role rule lives in the edge-safe `lib/two-factor.ts`; re-exported for
// the callers that already import it from here.
export { TWO_FACTOR_REQUIRED_ROLES, twoFactorRequired } from '@/lib/two-factor'
