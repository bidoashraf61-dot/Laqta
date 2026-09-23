/**
 * End-to-end auth check against a running server.
 *
 *   npm start &  →  npm run verify:auth
 *
 * Exercises both sign-in rails, the second factor, and the full role-guard
 * matrix for real, over HTTP, rather than asserting against mocks. Phone-OTP,
 * TOTP and middleware guards are exactly the paths that look fine in a unit
 * test and fail against a live Auth.js route.
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
    body: new URLSearchParams({ csrfToken, callbackUrl: `${BASE}/`, ...body }),
  })
  absorb(jar, response)

  // Auth.js answers `null`, not `{}`, when there is no session.
  const session = ((await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookieHeader(jar) },
  }).then((r) => r.json())) ?? {}) as { user?: { role?: string; id?: string } }

  return { jar, session }
}

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** What a guarded path actually did for this session. */
async function probe(jar: Jar, path: string) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: 'manual',
  })
  if (response.status === 307 || response.status === 302) return 'redirected'
  // Match a MARKER, never copy.
  //
  // This matched the literal «لا تملك صلاحية الوصول», first through a kashida
  // strip and then not at all: an editorial pass rewrote the title, the match
  // missed, and three blocked pages were reported as 'allowed'. A miss here is
  // a false result on the role-guard matrix, the one place that must never
  // produce one — so it keys on `data-page="forbidden"`, which no copy edit
  // touches. See app/(public)/forbidden/page.tsx.
  const body = await response.text()
  if (body.includes('data-page="forbidden"')) return 'forbidden'
  return response.ok ? 'allowed' : `http ${response.status}`
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
  report('phone OTP signs in', Boolean(otp.session.user))

  const replay = await signIn('phone', { phone, code: devCode ?? '' })
  report('a consumed OTP cannot be replayed', !replay.session.user)

  const fresh = await issueOtp(phone)
  const wrongOtp = await signIn('phone', {
    phone,
    code: fresh.devCode === '000000' ? '111111' : '000000',
  })
  report('wrong OTP is rejected', !wrongOtp.session.user)

  // ── TOTP second factor ────────────────────────────────────────────────────
  const secret = generateSecret()
  report('TOTP round-trips its own token', verifyToken(secret, generateToken(secret)))
  report('TOTP rejects a stale token', !verifyToken(secret, generateToken(secret, Date.now() - 300_000)))

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

  const withBad = await signIn('email', {
    email: 'buyer@agency.sa',
    password: 'Laqta!2026',
    totp: '000000',
  })
  report('2FA account refuses a wrong code', !withBad.session.user)

  await db.user.update({
    where: { email: 'buyer@agency.sa' },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })

  // ── Route guards ──────────────────────────────────────────────────────────
  console.log('\nRoute guards')

  const anon: Jar = new Map()
  for (const path of ['/account', '/studio', '/admin']) {
    report(`anonymous → ${path} redirects to sign-in`, (await probe(anon, path)) === 'redirected')
  }

  // Expected outcome per role, per path.
  const matrix: Array<[string, string, Record<string, string>]> = [
    [
      'buyer@agency.sa',
      'buyer',
      { '/account': 'allowed', '/studio': 'forbidden', '/admin': 'forbidden' },
    ],
    [
      'creator@laqta.sa',
      'creator',
      { '/account': 'allowed', '/studio': 'allowed', '/admin': 'forbidden' },
    ],
    [
      'admin@laqta.sa',
      'admin',
      { '/account': 'allowed', '/studio': 'allowed', '/admin': 'allowed' },
    ],
  ]

  for (const [address, role, expectations] of matrix) {
    const { jar, session } = await signIn('email', { email: address, password: 'Laqta!2026' })
    report(`${role} signs in`, session.user?.role === role, `got ${session.user?.role}`)
    for (const [path, expected] of Object.entries(expectations)) {
      const actual = await probe(jar, path)
      report(`  ${role} → ${path} is ${expected}`, actual === expected, `got ${actual}`)
    }
  }

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
