/**
 * Arabic coverage audit.
 *
 *   npm start &  →  npm run verify:arabic
 *
 * Crawls every route as a signed-in admin, strips the markup, and fails on any
 * visible Latin text that is not deliberately marked as an isolated foreign
 * run. Arabic owns the bare path; English lives under `/en` and is checked by
 * its own pass here, so a leak in either direction fails the suite.
 *
 * ── The rule it enforces ────────────────────────────────────────────────────
 * Latin is allowed only inside `.ltr-island`, `.numeric`, or `<code>`. That is
 * not a style preference: those wrappers set `unicode-bidi: isolate`, without
 * which a Latin run drags its punctuation and numerals to the wrong end of the
 * Arabic sentence around it. So "is it translated" and "is it correctly
 * isolated" are the same check, and this answers both.
 *
 * It reads attributes as well as text nodes — `placeholder`, `aria-label`,
 * `title`, `alt` — because that is where English actually survives review.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Adding a route? Put it in ROUTES.
 */

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
  '/forgot-password',
  '/reset-password',
  '/forbidden',
  '/footage',
  '/albums',
  '/albums/yousef-shami/alula-golden-hour-aerials',
  '/footage/alula-01',
  '/locations',
  '/locations/alula',
  '/categories',
  '/categories/aerials',
  '/collections',
  '/collections/saudi-heritage',
  '/creators',
  '/creators/yousef-shami',
  '/cart',
  // Marketing and policy documents.
  '/sell',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/licences',
  '/content-policy',
  '/account',
  '/account/security',
  '/account/library',
  '/account/purchases',
  '/account/downloads',
  '/account/boards',
  // Creator studio — every dashboard surface, not just the landing.
  '/studio',
  '/studio/analytics',
  '/studio/albums',
  '/studio/albums/new',
  '/studio/releases',
  '/studio/earnings',
  '/studio/payouts',
  '/studio/settings',
  // Admin control panel.
  '/admin',
  '/admin/analytics',
  '/admin/review',
  '/admin/creators',
  '/admin/disputes',
  '/admin/messages',
  '/admin/users',
  '/admin/catalogue',
  '/admin/taxonomy',
  '/admin/merchandising',
  '/admin/orders',
  '/admin/payouts',
  '/admin/promos',
  '/admin/content',
  '/admin/content/terms',
  '/admin/content/copy/landing',
  '/admin/content/copy/catalogue',
  '/admin/content/copy/email/preview',
  '/admin/reports',
  '/admin/settings',
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
      callbackUrl: `${BASE}/`,
    }),
  })
  absorb(jar, response)
  return jar
}

/**
 * Visible text, minus anything deliberately isolated. Islands in this codebase
 * are always a single non-nested element, so a targeted strip is enough and
 * keeps the script dependency-free.
 *
 * `<bdi>` counts as an island too. It carries `unicode-bidi: isolate` with
 * `dir="auto"`, which is the correct wrapper for text whose script we do not
 * control — a buyer's own search query, a claimant's name — where forcing LTR
 * would be as wrong as forcing RTL. What this audit is really asserting is
 * "every foreign run is isolated"; `<bdi>` satisfies that, and the content
 * inside it is user data rather than untranslated UI copy.
 */
/**
 * Removes any element that DECLARES itself to be in another language.
 *
 * `lang` on an element is the standards-defined way to say "this run is not the
 * page's language", and it is exactly what this audit asserts every foreign run
 * must do. The language switcher is the honest case: its label is deliberately
 * in the language it switches TO, carries `lang` and `dir` for that language,
 * and a screen reader consequently pronounces it correctly. Flagging it would
 * be flagging the very declaration the rule asks for.
 *
 * Strips the whole element, so its attributes leave with it — `aria-label` is
 * where this text actually lives, and `attributeCopy` scans the raw HTML.
 *
 * `<html>` is excluded, and not as a tidiness measure: it carries the page's own
 * `lang`, so without the exclusion the very first match is the entire document.
 * The callback then returns it unchanged (the language does match), the regex
 * has consumed everything, and the function silently becomes a no-op — which is
 * exactly how it first shipped.
 */
function stripForeignRuns(html: string, pageLang: string) {
  return html.replace(
    /<(?!html\b)([a-z]+)\b[^>]*\blang="([^"]+)"[^>]*>[\s\S]*?<\/\1>/gi,
    (match, _tag, lang: string) => (lang.split('-')[0] === pageLang ? match : ' '),
  )
}

function visibleText(html: string) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<([a-z]+)[^>]*class="[^"]*(?:ltr-island|numeric)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<bdi\b[^>]*>[\s\S]*?<\/bdi>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    // A textarea's content is its VALUE — data being edited, like an input's
    // `value` attribute, which this never read either. The admin copy editor
    // (DEV-64b) holds `{count}`-style placeholders there by design.
    .replace(/<textarea\b[\s\S]*?<\/textarea>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

async function auditRoutes() {
  const jar = await adminJar()
  console.log('Arabic coverage\n')

  for (const route of ROUTES) {
    const response = await fetch(`${BASE}${route}`, { headers: { Cookie: cookieHeader(jar) } })
    const html = await response.text()
    const scoped = stripForeignRuns(html, 'ar')
    const body = `${visibleText(scoped)} ${attributeCopy(scoped)}`
    const offenders = latinOffenders(body)

    if (!ARABIC.test(body)) {
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

async function auditShell() {
  console.log('\nDocument shell, the /en surface, and the retired /ar prefix')

  for (const [path, lang, dir] of [
    ['/', 'ar', 'rtl'],
    ['/en', 'en', 'ltr'],
  ]) {
    const html = await fetch(`${BASE}${path}`).then((r) => r.text())
    const tag = html.match(/<html[^>]*>/)?.[0] ?? ''
    const ok = tag.includes(`lang="${lang}"`) && tag.includes(`dir="${dir}"`)
    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${path} → ${tag}`)
  }

  // `/ar` was retired when Arabic took the bare path. Those URLs must not 404.
  for (const [from, expected] of [
    ['/ar', '/'],
    ['/ar/albums', '/albums'],
  ]) {
    const response = await fetch(`${BASE}${from}`, { redirect: 'manual' })
    const location = response.headers.get('location') ?? ''
    const ok = response.status === 308 && new URL(location, BASE).pathname === expected
    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${from} → ${location || `${response.status}, no redirect`}`)
  }

  // `/en` must SERVE, not redirect — it is the English surface, and a redirect
  // here would quietly delete the translation from the index.
  for (const path of ['/en', '/en/albums', '/en/sign-in']) {
    const response = await fetch(`${BASE}${path}`, { redirect: 'manual' })
    const ok = response.status === 200
    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${path} → ${response.status}`)
  }

  // A role guard must not be bypassable by adding a locale prefix.
  const guarded = await fetch(`${BASE}/en/admin`, { redirect: 'manual' })
  const guardOk = guarded.status === 307 || guarded.status === 302
  if (!guardOk) failures += 1
  console.log(`  ${guardOk ? 'PASS' : 'FAIL'}  /en/admin (signed out) → ${guarded.status}`)
}

/**
 * The mirror of `auditRoutes`: every English route must be free of Arabic.
 *
 * A one-directional check would pass a site where `/en` silently served Arabic,
 * which is exactly the failure this feature is most likely to regress into.
 */
async function auditEnglishRoutes() {
  console.log('\nEnglish routes')

  // Signed-out fetches only: the dashboards are Arabic-only operator tools and
  // are not part of the English surface.
  const AUTHED = ['/account', '/studio', '/admin']

  // `العلا`/`العُلا` appear in the About page ON PURPOSE, as the worked example
  // of Arabic search variants reaching one record. They are content, not a leak.
  const ALLOWED = new Set(['/en/about'])

  for (const route of ROUTES.filter((r) => !AUTHED.some((a) => r.startsWith(a)))) {
    const path = route === '/' ? '/en' : `/en${route}`
    const html = await fetch(`${BASE}${path}`).then((r) => r.text())
    const scoped = stripForeignRuns(html, 'en')
    const text = `${visibleText(scoped)} ${attributeCopy(scoped)}`
    const arabic = ALLOWED.has(path) ? [] : text.match(/[\u0600-\u06FF][\u0600-\u06FF\s\u0640]{2,}/g)
    const ok = !arabic || arabic.length === 0
    if (!ok) failures += 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${path}${ok ? '' : ` — ${[...new Set(arabic)].slice(0, 3).join(' · ')}`}`)
  }
}

async function main() {
  await auditRoutes()
  await auditEnglishRoutes()
  await auditShell()
  console.log(
    failures === 0 ? '\nArabic routes are fully Arabic; English routes are fully English.' : `\n${failures} check(s) failed.`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
