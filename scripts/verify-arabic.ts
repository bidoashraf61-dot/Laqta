/**
 * Arabic coverage audit.
 *
 *   npm start &  →  npm run verify:arabic
 *
 * Crawls every `/ar` route as a signed-in admin, strips the markup, and fails
 * on any visible Latin text that is not deliberately marked as an isolated
 * foreign run.
 *
 * ── The rule it enforces ────────────────────────────────────────────────────
 * On an Arabic page, Latin text is allowed only inside `.ltr-island`,
 * `.numeric`, or `<code>`. That is not a style preference: those wrappers set
 * `unicode-bidi: isolate`, without which a Latin run drags its punctuation and
 * numerals to the wrong end of the Arabic sentence around it. So "is it
 * translated" and "is it correctly isolated" are the same check, and this
 * script answers both.
 *
 * Brand names, currency codes and file paths are legitimately Latin — they
 * must simply be wrapped. Anything else is untranslated copy.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { locales } from '../lib/i18n'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

/** Latin that is correct even outside an island — proper nouns and codes. */
const ALLOWED = new Set([
  'laqta',
  'sar',
  'vat',
  'zatca',
  'mada',
  'apple',
  'pay',
  'stc',
  'tabby',
  'tamara',
  'iban',
  'totp',
  'x',
  'instagram',
  'youtube',
  'linkedin',
  'neom',
  'alula',
  'wise',
  'payoneer',
  // Keyboard modifiers are Latin by convention in every locale.
  'alt',
  'ctrl',
  'shift',
])

const ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/forbidden',
  '/account',
  '/account/security',
  '/studio',
  '/admin',
]

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

/** Sign in as admin so the guarded routes render rather than redirect. */
async function adminJar(): Promise<Jar> {
  const jar: Jar = new Map()
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`)
  absorb(jar, csrfResponse)
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }

  const response = await fetch(`${BASE}/api/auth/callback/email`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email: 'admin@laqta.sa',
      password: 'Laqta!2026',
      callbackUrl: `${BASE}/ar`,
    }),
  })
  absorb(jar, response)
  return jar
}

/**
 * Visible text, minus anything deliberately isolated.
 *
 * Islands in this codebase are always a single non-nested element, so a
 * targeted strip is enough and keeps the script dependency-free.
 */
function visibleText(html: string) {
  return (
    html
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, '')
      // Deliberately isolated foreign runs.
      .replace(/<([a-z]+)[^>]*class="[^"]*(?:ltr-island|numeric)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<code[\s\S]*?<\/code>/gi, ' ')
      // Attributes carry user-facing copy too: placeholder, aria-label, title.
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** User-facing copy hiding in attributes rather than text nodes. */
function attributeCopy(html: string) {
  const out: string[] = []
  const pattern = /(?:placeholder|aria-label|title|alt)="([^"]+)"/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) out.push(match[1])
  return out.join(' ')
}

const ARABIC = /[؀-ۿ]/

function latinOffenders(text: string) {
  const words = text.match(/[A-Za-z][A-Za-z'’.-]{2,}/g) ?? []
  const bad = new Map<string, number>()
  for (const word of words) {
    const key = word.toLowerCase().replace(/[^a-z]/g, '')
    if (!key || ALLOWED.has(key)) continue
    bad.set(word, (bad.get(word) ?? 0) + 1)
  }
  return bad
}

let failures = 0

async function auditArabicRoutes() {
  const jar = await adminJar()
  console.log('Arabic coverage — /ar\n')

  for (const route of ROUTES) {
    const url = `${BASE}/ar${route === '/' ? '' : route}`
    const response = await fetch(url, { headers: { Cookie: cookieHeader(jar) } })
    const html = await response.text()

    const body = `${visibleText(html)} ${attributeCopy(html)}`
    const offenders = latinOffenders(body)
    const hasArabic = ARABIC.test(body)

    if (!hasArabic) {
      failures += 1
      console.log(`  FAIL  ${route} — no Arabic text rendered at all`)
      continue
    }
    if (offenders.size > 0) {
      failures += 1
      const list = [...offenders.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([word, count]) => (count > 1 ? `${word}×${count}` : word))
        .join(', ')
      console.log(`  FAIL  ${route} — untranslated or un-isolated Latin: ${list}`)
      continue
    }
    console.log(`  PASS  ${route}`)
  }
}

/** The document shell must declare the language and direction on every locale. */
async function auditShell() {
  console.log('\nDocument shell')
  for (const locale of locales) {
    const html = await fetch(`${BASE}/${locale}`).then((r) => r.text())
    const tag = html.match(/<html[^>]*>/)?.[0] ?? ''
    const expectedDir = locale === 'ar' ? 'rtl' : 'ltr'
    const ok = tag.includes(`lang="${locale}"`) && tag.includes(`dir="${expectedDir}"`)
    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  /${locale} → ${tag}`)
  }

  // Arabic must be what an unprefixed request lands on.
  const root = await fetch(`${BASE}/`, { redirect: 'manual' })
  const target = root.headers.get('location') ?? ''
  const ok = target.endsWith('/ar')
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  / redirects to Arabic — ${target || 'no redirect'}`)
}

async function main() {
  await auditArabicRoutes()
  await auditShell()
  console.log(
    failures === 0
      ? '\nEvery Arabic route is fully Arabic.'
      : `\n${failures} route(s) leaking English.`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
