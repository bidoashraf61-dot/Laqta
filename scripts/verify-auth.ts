/**
 * End-to-end auth check against a running server.
 *
 *   npm start &  →  npm run verify:auth
 *
 * Exercises the email rail, the second factor, and the full role-guard
 * matrix for real, over HTTP, rather than asserting against mocks. TOTP and
 * middleware guards are exactly the paths that look fine in a unit test and
 * fail against a live Auth.js route. The phone rail is checked to be SHUT:
 * with no SMS provider, a correct code must still not start a session.
 */
// The reset section queues real outbox rows. Blank the provider first — blank,
// not delete, because dotenv never overrides a key that already exists — so a
// deployment's Resend key in .env can never turn a fixture into real mail.
for (const key of ['MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM']) process.env[key] = ''

import bcrypt from 'bcryptjs'
import { issueOtp, consumeOtp, phoneSignInEnabled } from '../lib/otp'
import { normalisePhone } from '../lib/auth'
import { generateToken, generateSecret, verifyToken } from '../lib/totp'
import { db } from '../lib/db'
import { codeFor } from './two-factor-fixture.mjs'
import {
  requestPasswordReset,
  resetPassword,
  RESET_LIMIT_PER_EMAIL,
  RESET_LIMIT_PER_IP,
} from '../lib/password-reset'

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
  // The layout lock. When middleware admits a cookie that `auth()` then
  // refuses (a session older than a password reset), the route-group layout's
  // `redirect()` fires after the shell has begun streaming — so it arrives as
  // a 200 whose payload carries the redirect, which the browser follows.
  if (/NEXT_REDIRECT;[a-z]+;\/sign-in/.test(body)) return 'redirected'
  return response.ok ? 'allowed' : `http ${response.status}`
}

async function main() {
  console.log('Auth verification\n')

  // ── Email + password ──────────────────────────────────────────────────────
  const email = await signIn('email', { email: 'buyer@agency.sa', password: 'Laqta!2026' })
  report('email + password signs in', email.session.user?.role === 'buyer', `role=${email.session.user?.role}`)

  const wrong = await signIn('email', { email: 'buyer@agency.sa', password: 'not-the-password' })
  report('wrong password is rejected', !wrong.session.user)

  // ── Phone OTP: shut until an SMS provider exists ──────────────────────────
  // Before DEV-01 a missing provider handed the code to the browser, so on a
  // live site anyone could sign in as any phone. The rail is now refused on
  // the server, and the code store itself is still checked in-process.
  const phone = normalisePhone('0500000003')
  report('KSA number normalises to E.164', phone === '+966500000003', phone)

  report('phone rail is off with no SMS provider', !phoneSignInEnabled())

  const nodeEnv = process.env as Record<string, string | undefined>
  const realEnv = nodeEnv.NODE_ENV
  nodeEnv.NODE_ENV = 'production'
  const prodIssue = await issueOtp(phone)
  nodeEnv.NODE_ENV = realEnv
  report('production never returns the plain code', prodIssue.devCode === null)

  const { devCode } = await issueOtp(phone)
  const refused = await signIn('phone', { phone, code: devCode ?? '' })
  report('a correct code does not sign in while the rail is off', !refused.session.user)

  const signInPage = await fetch(`${BASE}/sign-in`).then((r) => r.text())
  report(
    'sign-in page shows no phone tab',
    !signInPage.includes('type="tel"') && !signInPage.includes('رمز الجوال'),
  )

  // The code store, ready for when SMS lands.
  report('OTP store accepts the right code', await consumeOtp(phone, devCode ?? ''))
  report('a consumed OTP cannot be replayed', !(await consumeOtp(phone, devCode ?? '')))
  const fresh = await issueOtp(phone)
  report('wrong OTP is rejected', !(await consumeOtp(phone, fresh.devCode === '000000' ? '111111' : '000000')))

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

  // Creator and admin are enrolled in 2FA by the seed (it is mandatory), so
  // they sign in with the code, as a person would.
  for (const [address, role, expectations] of matrix) {
    const code = await codeFor(address)
    const { jar, session } = await signIn('email', {
      email: address,
      password: 'Laqta!2026',
      ...(code ? { totp: code } : {}),
    })
    report(`${role} signs in`, session.user?.role === role, `got ${session.user?.role}`)
    for (const [path, expected] of Object.entries(expectations)) {
      const actual = await probe(jar, path)
      report(`  ${role} → ${path} is ${expected}`, actual === expected, `got ${actual}`)
    }
  }

  await mandatoryTwoFactor()
  await passwordReset()

  console.log(failures === 0 ? '\nAll auth checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

/** Where a guarded path sent this session: the redirect target, or the outcome. */
async function landing(jar: Jar, path: string) {
  const response = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(jar) }, redirect: 'manual' })
  const location = response.headers.get('location')
  if (location) return new URL(location, BASE).pathname + new URL(location, BASE).search
  const body = await response.text()
  // The layout lock streams its redirect inside a 200 (see probe()).
  const streamed = body.match(/NEXT_REDIRECT;[a-z]+;([^;"\\]+)/)
  if (streamed) return `layout→${streamed[1]}`
  return response.ok ? 'allowed' : `http ${response.status}`
}

/**
 * Two-factor is mandatory for creator and admin (lib/two-factor.ts): an
 * unenrolled one signs in, but /admin and /studio send them to
 * /account/security, in the language they were reading, remembering where
 * they were going. Throwaway accounts on `.test`, deleted afterwards.
 */
async function mandatoryTwoFactor() {
  console.log('\nMandatory two-factor')

  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const passwordHash = await bcrypt.hash('Laqta!2026', 10)
  const admin = await db.user.create({
    data: { email: `tfa-admin-${run}@laqta.test`, name: 'TFA Admin', role: 'admin', passwordHash, locale: 'ar' },
  })
  const creatorUser = await db.user.create({
    data: { email: `tfa-creator-${run}@laqta.test`, name: 'TFA Creator', role: 'creator', passwordHash, locale: 'ar' },
  })
  const creator = await db.creator.create({
    data: {
      userId: creatorUser.id,
      handle: `tfa-${run}`.slice(0, 30),
      displayNameAr: 'صانع تجريبي',
      displayNameEn: 'TFA Creator',
      status: 'approved',
    },
  })
  const secret = generateSecret()

  try {
    // ── Unenrolled: signs in, held on the enrolment page ────────────────────
    const a = await signIn('email', { email: admin.email!, password: 'Laqta!2026' })
    report('an unenrolled admin still signs in', a.session.user?.role === 'admin')
    report(
      '  …and the session says 2FA is off',
      (a.session.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled === false,
    )
    const holds: Array<[string, string]> = [
      ['/admin', '/account/security?next=%2Fadmin'],
      ['/admin/orders?status=paid', '/account/security?next=%2Fadmin%2Forders%3Fstatus%3Dpaid'],
      ['/studio', '/account/security?next=%2Fstudio'],
      ['/en/admin', '/en/account/security?next=%2Fen%2Fadmin'],
      ['/en/studio/albums', '/en/account/security?next=%2Fen%2Fstudio%2Falbums'],
    ]
    for (const [path, expected] of holds) {
      const actual = await landing(a.jar, path)
      report(`  admin ${path} → ${expected.split('?')[0]}`, actual === expected, actual)
    }
    report('  /account/security stays open', (await landing(a.jar, '/account/security')) === 'allowed')
    report('  /en/account/security stays open', (await landing(a.jar, '/en/account/security')) === 'allowed')
    report('  /account stays open', (await landing(a.jar, '/account')) === 'allowed')
    report('  sign-out stays open', (await fetch(`${BASE}/api/auth/signout`, { headers: { Cookie: cookieHeader(a.jar) } })).ok)

    const page = await fetch(`${BASE}/account/security?next=%2Fadmin`, { headers: { Cookie: cookieHeader(a.jar) } }).then((r) => r.text())
    report('  the page says why (the 2FA notice)', page.includes('data-two-factor="required"'))
    const english = await fetch(`${BASE}/en/account/security?next=%2Fen%2Fadmin`, { headers: { Cookie: cookieHeader(a.jar) } }).then((r) => r.text())
    report('  …in English under /en', english.includes('data-two-factor="required"') && english.includes('Turn on two-factor'))

    const c = await signIn('email', { email: creatorUser.email!, password: 'Laqta!2026' })
    report('an unenrolled creator → /studio is sent to enrol', (await landing(c.jar, '/studio')) === '/account/security?next=%2Fstudio')
    const upload = await fetch(`${BASE}/api/studio/uploads/not-a-clip`, { headers: { Cookie: cookieHeader(c.jar) } })
    report(
      '  …and the studio upload API refuses them (outside middleware)',
      upload.status === 403 && ((await upload.json()) as { error?: string }).error === 'two_factor_required',
      String(upload.status),
    )

    // ── Enrolled: through ───────────────────────────────────────────────────
    await db.user.update({ where: { id: admin.id }, data: { twoFactorEnabled: true, twoFactorSecret: secret } })
    // A cookie from before the enrolment still says `false`; the session
    // endpoint re-issues it from the database, as the page's «المتابعة» does.
    const stale = await landing(a.jar, '/admin')
    report('a cookie from before enrolling is still held (by its claim)', stale.startsWith('/account/security'), stale)
    const held = await fetch(`${BASE}/account/security?next=%2Fadmin`, { headers: { Cookie: cookieHeader(a.jar) } }).then((r) => r.text())
    report('  …and the page offers «المتابعة» instead of the notice', held.includes('data-two-factor="ready"') && !held.includes('data-two-factor="required"'))
    // «المتابعة» only ever leads to a dashboard: an off-site or non-dashboard
    // `next` gets no button at all (safeDashboardReturn).
    for (const next of ['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', '%2Faccount%2Flibrary']) {
      const body = await fetch(`${BASE}/account/security?next=${next}`, { headers: { Cookie: cookieHeader(a.jar) } }).then((r) => r.text())
      report(`  a next of ${decodeURIComponent(next)} gets no «المتابعة»`, !body.includes('data-two-factor="ready"'))
    }
    absorb(a.jar, await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader(a.jar) } }))
    report('  …a refreshed session opens /admin', (await landing(a.jar, '/admin')) === 'allowed')

    const fresh = await signIn('email', { email: admin.email!, password: 'Laqta!2026', totp: generateToken(secret) })
    report('an enrolled admin signs in with the code', fresh.session.user?.role === 'admin')
    report('  …and /admin opens', (await landing(fresh.jar, '/admin')) === 'allowed')

    // ── The layout lock: the database, not the cookie ───────────────────────
    // 2FA taken away after sign-in (an operator reset): the cookie still says
    // enrolled, middleware lets it pass, and the layout sends it to enrol.
    await db.user.update({ where: { id: admin.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } })
    const locked = await landing(fresh.jar, '/admin')
    report('2FA removed mid-session: the layout sends /admin to enrol', locked.startsWith('layout→/account/security'), locked)
  } finally {
    await db.creator.delete({ where: { id: creator.id } }).catch(() => {})
    await db.user.deleteMany({ where: { id: { in: [admin.id, creatorUser.id] } } })
  }
}

/** The plaintext token from the newest queued reset message for this address. */
async function latestToken(address: string) {
  const row = await db.mailOutbox.findFirst({
    where: { toEmail: address, template: 'auth.passwordReset' },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  })
  const url = (row?.payload as { resetUrl?: string } | null)?.resetUrl
  return url ? new URL(url).searchParams.get('token') : null
}

async function resetPageState(token: string) {
  const body = await fetch(`${BASE}/reset-password?token=${encodeURIComponent(token)}`).then((r) => r.text())
  return body.match(/data-reset="(live|dead)"/)?.[1] ?? 'missing'
}

/**
 * «نسيت كلمة المرور؟» end to end. The request and the reset run in-process
 * against the shared database (a server action has no stable URL to POST to);
 * everything a reader or an attacker would touch — the reset page, sign-in,
 * an existing session — goes over HTTP to the running server.
 *
 * A throwaway account on the reserved `.test` TLD, and throwaway IPs from
 * TEST-NET-3, so repeated runs never share a rate-limit bucket.
 */
async function passwordReset() {
  console.log('\nPassword reset')

  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const address = `reset-${run}@laqta.test`
  const ip = `203.0.113.${Number(run.slice(-3)) % 255}-${run}`
  const oldPassword = 'Old-Pass!2026'
  const newPassword = 'New-Pass!2026'
  const secret = generateSecret()

  const user = await db.user.create({
    data: { email: address, name: 'Reset Check', passwordHash: await bcrypt.hash(oldPassword, 10), locale: 'en' },
  })

  try {
    // ── Same answer, known or not ──────────────────────────────────────────
    // What the action returns is { status: 'sent', email, devLink }. Compared
    // as production renders it, where devLink is always null.
    const env = process.env as Record<string, string | undefined>
    const realNodeEnv = env.NODE_ENV
    env.NODE_ENV = 'production'
    const unknownAddress = `nobody-${run}@laqta.test`
    const unknown = await requestPasswordReset({ email: unknownAddress, ip: `${ip}-u`, pageLocale: 'ar' })
    const known = await requestPasswordReset({ email: address, ip, pageLocale: 'ar' })
    env.NODE_ENV = realNodeEnv
    report(
      'unknown and known address get the same answer',
      unknown.devLink === null && known.devLink === null,
      `unknown=${unknown.outcome} known=${known.outcome}`,
    )
    const unknownRows = await db.mailOutbox.count({ where: { toEmail: unknownAddress } })
    report('  …and only the known one queued a message', unknownRows === 0 && known.outcome === 'queued')

    const queued = await db.mailOutbox.findFirst({
      where: { toEmail: address, template: 'auth.passwordReset' },
      select: { locale: true, payload: true },
    })
    const firstToken = await latestToken(address)
    report('the message is in the account locale, link included', queued?.locale === 'en' && Boolean(firstToken))
    report(
      '  …and the link is to the English page',
      String((queued?.payload as { resetUrl?: string })?.resetUrl ?? '').includes('/en/reset-password?token='),
    )
    const stored = await db.passwordResetToken.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
    report(
      'the token is stored hashed, not in plaintext',
      Boolean(stored) && stored!.tokenHash !== firstToken && stored!.tokenHash.length === 64,
    )
    report('the reset page accepts a live token', (await resetPageState(firstToken ?? '')) === 'live')
    report('the reset page refuses a made-up token', (await resetPageState('not-a-token')) === 'dead')

    // ── A newer link retires the older one ─────────────────────────────────
    await requestPasswordReset({ email: address, ip, pageLocale: 'ar' })
    const secondToken = await latestToken(address)
    report('a newer request retires the older link', (await resetPageState(firstToken ?? '')) === 'dead')
    report('  …and the older link cannot reset', !(await resetPassword(firstToken ?? '', newPassword)).ok)

    // ── The reset itself: sessions end, 2FA survives, single use ───────────
    await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorSecret: secret } })
    const before = await signIn('email', { email: address, password: oldPassword, totp: generateToken(secret) })
    report('a session exists before the reset', Boolean(before.session.user))

    const short = await resetPassword(secondToken ?? '', 'short')
    report('a password under 8 characters is refused', !short.ok)

    const done = await resetPassword(secondToken ?? '', newPassword)
    report('the live token resets the password', done.ok)
    report('  …and cannot be used twice', !(await resetPassword(secondToken ?? '', 'Another-Pass!1')).ok)

    const after = (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader(before.jar) } }).then(
      (r) => r.json(),
    )) as { user?: unknown } | null
    report('the session from before the reset is signed out', !after?.user)
    report('  …and /account turns it away', (await probe(before.jar, '/account')) === 'redirected')

    const oldPw = await signIn('email', { email: address, password: oldPassword, totp: generateToken(secret) })
    report('the old password stops working', !oldPw.session.user)
    const noCode = await signIn('email', { email: address, password: newPassword })
    report('2FA is still required after a reset', !noCode.session.user)
    const withCode = await signIn('email', { email: address, password: newPassword, totp: generateToken(secret) })
    report('the new password + code signs in', Boolean(withCode.session.user))

    // ── Expired ───────────────────────────────────────────────────────────
    await requestPasswordReset({ email: address, ip, pageLocale: 'ar' })
    const thirdToken = await latestToken(address)
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    report('an expired link shows the dead-link page', (await resetPageState(thirdToken ?? '')) === 'dead')
    report('an expired link cannot reset', !(await resetPassword(thirdToken ?? '', 'Expired-Pass!1')).ok)
    const still = await signIn('email', { email: address, password: newPassword, totp: generateToken(secret) })
    report('  …and the password is unchanged', Boolean(still.session.user))

    // ── Rate limits ───────────────────────────────────────────────────────
    // Three accepted requests so far for this address (limit 3/hour).
    const rowsBefore = await db.mailOutbox.count({ where: { toEmail: address } })
    const limited = await requestPasswordReset({ email: address, ip: `${ip}-other`, pageLocale: 'ar' })
    const rowsAfter = await db.mailOutbox.count({ where: { toEmail: address } })
    report(
      `request ${RESET_LIMIT_PER_EMAIL + 1} for one address in an hour is limited`,
      limited.outcome === 'rate_limited' && rowsAfter === rowsBefore,
      limited.outcome,
    )

    const sweepIp = `${ip}-sweep`
    let last = ''
    for (let i = 0; i <= RESET_LIMIT_PER_IP; i++) {
      last = (await requestPasswordReset({ email: `sweep-${run}-${i}@laqta.test`, ip: sweepIp, pageLocale: 'ar' })).outcome
    }
    report(`request ${RESET_LIMIT_PER_IP + 1} from one IP in an hour is limited`, last === 'rate_limited', last)
  } finally {
    // Tokens cascade with the user; the queued fixture mail goes too.
    await db.mailOutbox.deleteMany({ where: { toEmail: { endsWith: `${run}@laqta.test` } } })
    await db.mailOutbox.deleteMany({ where: { toEmail: address } })
    await db.user.delete({ where: { id: user.id } })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
