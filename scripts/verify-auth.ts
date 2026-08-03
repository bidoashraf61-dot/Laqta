/**
 * End-to-end auth check against a running server.
 *
 *   npm start &  →  npx tsx scripts/verify-auth.ts
 *
 * Exercises the two sign-in rails and the second factor for real, over HTTP,
 * rather than asserting against mocks: phone-OTP and TOTP are exactly the
 * paths that look fine in a unit test and fail against a live Auth.js route.
 */
import { issueOtp } from '../lib/otp'
import { normalisePhone } from '../lib/auth'
import { generateToken, generateSecret, verifyToken } from '../lib/totp'
import { db } from '../lib/db'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

type Jar = Map<string, string>

function cookieHeader(jar: Jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

function absorb(jar: Jar, response: Response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';')
    const index = pair.indexOf('=')
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim())
  }
}

async function signIn(provider: string, body: Record<string, string>) {
  const jar: Jar = new Map()

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`)
  absorb(jar, csrfResponse)
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }

  const response = await fetch(`${BASE}/api/auth/callback/${provider}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${BASE}/ar`, ...body }),
  })
  absorb(jar, response)

  // Auth.js answers `null`, not `{}`, when there is no session.
  const session = ((await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookieHeader(jar) },
  }).then((r) => r.json())) ?? {}) as { user?: { role?: string; id?: string } }

  return { location: response.headers.get('location') ?? '', session }
}

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Auth verification\n')

  // ── Email + password ──────────────────────────────────────────────────────
  const email = await signIn('email', { email: 'buyer@agency.sa', password: 'Laqta!2026' })
  report('email + password signs in', email.session.user?.role === 'buyer', `role=${email.session.user?.role}`)

  const wrong = await signIn('email', { email: 'buyer@agency.sa', password: 'not-the-password' })
  report('wrong password is rejected', !wrong.session.user)

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const phone = normalisePhone('0500000003')
  report('KSA number normalises to E.164', phone === '+966500000003', phone)

  const { devCode } = await issueOtp(phone)
  report('OTP issued with a dev code', Boolean(devCode))

  const otp = await signIn('phone', { phone, code: devCode ?? '' })
  report('phone OTP signs in', Boolean(otp.session.user), `role=${otp.session.user?.role}`)

  const replay = await signIn('phone', { phone, code: devCode ?? '' })
  report('a consumed OTP cannot be replayed', !replay.session.user)

  const badCode = await issueOtp(phone)
  const wrongOtp = await signIn('phone', { phone, code: badCode.devCode === '000000' ? '111111' : '000000' })
  report('wrong OTP is rejected', !wrongOtp.session.user)

  // ── TOTP second factor ────────────────────────────────────────────────────
  const secret = generateSecret()
  report('TOTP round-trips its own token', verifyToken(secret, generateToken(secret)))
  report('TOTP rejects a stale token', !verifyToken(secret, generateToken(secret, Date.now() - 300_000)))

  // Enrol the buyer, then prove the password alone no longer gets in.
  await db.user.update({
    where: { email: 'buyer@agency.sa' },
    data: { twoFactorEnabled: true, twoFactorSecret: secret },
  })

  const without = await signIn('email', { email: 'buyer@agency.sa', password: 'Laqta!2026' })
  report('2FA account refuses password alone', !without.session.user)

  const withCode = await signIn('email', {
    email: 'buyer@agency.sa',
    password: 'Laqta!2026',
    totp: generateToken(secret),
  })
  report('2FA account accepts password + code', Boolean(withCode.session.user))

  const withBadCode = await signIn('email', {
    email: 'buyer@agency.sa',
    password: 'Laqta!2026',
    totp: '000000',
  })
  report('2FA account refuses a wrong code', !withBadCode.session.user)

  // Leave the seeded buyer as the seed made it.
  await db.user.update({
    where: { email: 'buyer@agency.sa' },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })

  console.log(failures === 0 ? '\nAll auth checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
