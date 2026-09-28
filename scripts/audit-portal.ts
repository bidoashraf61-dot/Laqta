/**
 * Whole-portal audit.
 *
 *   npm start &  →  npm run audit
 *
 * Drives real Chrome over every route as an admin, at desktop and phone
 * widths, in Arabic and in English (DEV-55), and reports the defect classes that only show up in a browser:
 * script errors, failed requests, dead links, unlabelled controls, images
 * without alt text, broken heading order, horizontal overflow, and RTL
 * breakage from physical CSS properties.
 *
 * It is deliberately noisy about WHERE — a finding you cannot locate is a
 * finding nobody fixes.
 */

import { chromium, type Browser, type Page } from 'playwright'
import { submitSignIn } from './two-factor-fixture.mjs'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

const ROUTES = [
  '/',
  '/footage',
  '/albums',
  '/albums/yousef-shami/alula-golden-hour-aerials',
  '/footage/alula-01',
  '/categories',
  '/categories/aerials',
  '/locations',
  '/locations/alula',
  '/occasions/ramadan',
  '/blog',
  '/blog/choosing-establishing-shots',
  '/collections',
  '/collections/saudi-heritage',
  '/creators',
  '/creators/yousef-shami',
  '/cart',
  '/checkout',
  '/checkout/return',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/sell',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/licences',
  '/content-policy',
  '/account',
  '/account/library',
  '/account/purchases',
  '/account/downloads',
  '/account/boards',
  '/account/security',
  '/studio',
  '/studio/analytics',
  '/studio/albums',
  '/studio/albums/new',
  '/studio/releases',
  '/studio/guide',
  '/studio/earnings',
  '/studio/payouts',
  '/studio/settings',
  '/admin',
  '/admin/analytics',
  '/admin/review',
  '/admin/creators',
  '/admin/disputes',
  '/admin/messages',
  '/admin/waitlist',
  '/admin/blog',
  '/admin/users',
  '/admin/catalogue',
  '/admin/taxonomy',
  '/admin/merchandising',
  '/admin/orders',
  '/admin/payouts',
  '/admin/promos',
  '/admin/bundles',
  '/admin/bundles/new',
  '/admin/content',
  '/admin/content/terms',
  '/admin/content/copy/landing',
  '/admin/content/copy/catalogue',
  '/admin/content/copy/email/preview',
  '/admin/reports',
  '/admin/settings',
]

type Finding = { route: string; viewport: string; kind: string; detail: string }
const findings: Finding[] = []
const add = (route: string, viewport: string, kind: string, detail: string) =>
  findings.push({ route, viewport, kind, detail })

/**
 * Sign in through the real credentials rail so guarded routes render.
 *
 * Two identities, because they see different things: an admin has no creator
 * profile, so `/studio` redirects it to `/sell` and the whole creator portal
 * would be audited as a marketing page. The creator account is the only one
 * that actually renders the studio.
 */
async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' })
  // Creator and admin answer the 2FA step too (scripts/two-factor-fixture.mjs).
  await submitSignIn(page, email, 'Laqta!2026')
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 20_000 }).catch(() => {})
  await page.close()
  return context
}

/**
 * In-page checks. Runs in the browser because every one of these needs
 * computed layout or the live accessibility tree, not the HTML string.
 */
async function inspect(page: Page) {
  return page.evaluate(() => {
    const out: Array<{ kind: string; detail: string }> = []

    // Horizontal overflow — the single most common responsive defect, and the
    // one that makes a phone layout feel broken rather than merely tight.
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth + 1) {
      const culprits: string[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0) continue
        // In RTL, overflow escapes to the LEFT (negative x) as well as right.
        if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
          const style = getComputedStyle(el)
          if (style.position === 'fixed' || style.visibility === 'hidden') continue
          culprits.push(
            `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''}`,
          )
          if (culprits.length >= 3) break
        }
      }
      out.push({
        kind: 'overflow',
        detail: `page scrolls sideways (${doc.scrollWidth}px in ${doc.clientWidth}px)${culprits.length ? ' — ' + culprits.join(', ') : ''}`,
      })
    }

    // Controls with no accessible name.
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea'),
    )) {
      if (el.getAttribute('aria-hidden') === 'true') continue
      if ((el as HTMLInputElement).type === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      const labelled =
        el.getAttribute('aria-label')?.trim() ||
        el.getAttribute('title')?.trim() ||
        (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()) ||
        el.closest('label')?.textContent?.trim() ||
        (el.getAttribute('aria-labelledby') &&
          document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent?.trim()) ||
        el.textContent?.trim() ||
        (el as HTMLInputElement).placeholder?.trim()
      if (!labelled) {
        out.push({
          kind: 'unlabelled-control',
          detail: `<${el.tagName.toLowerCase()}${(el as HTMLInputElement).name ? ` name="${(el as HTMLInputElement).name}"` : ''}> has no accessible name`,
        })
      }
    }

    // Images without an alt attribute at all (alt="" is a valid decorative
    // declaration; a MISSING alt is the defect).
    for (const img of Array.from(document.querySelectorAll('img'))) {
      if (!img.hasAttribute('alt')) {
        out.push({ kind: 'missing-alt', detail: `<img src="${img.getAttribute('src')?.slice(0, 60)}">` })
      }
    }

    // Exactly one h1, and no skipped heading levels.
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    const h1s = headings.filter((h) => h.tagName === 'H1')
    if (h1s.length === 0) out.push({ kind: 'heading', detail: 'no <h1> on the page' })
    if (h1s.length > 1) out.push({ kind: 'heading', detail: `${h1s.length} <h1> elements` })
    let previous = 0
    for (const h of headings) {
      const level = Number(h.tagName[1])
      if (previous && level > previous + 1) {
        out.push({
          kind: 'heading',
          detail: `h${previous} → h${level} skips a level ("${h.textContent?.trim().slice(0, 40)}")`,
        })
        break
      }
      previous = level
    }

    // Physical CSS in an RTL document — the rule CLAUDE.md makes binding.
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *')).slice(0, 4000)) {
      const cls = typeof el.className === 'string' ? el.className : ''
      const bad = cls.match(/(?:^|\s)(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|border-l-|border-r-)\S*/)
      if (bad) {
        out.push({ kind: 'physical-css', detail: `${el.tagName.toLowerCase()} uses "${bad[0].trim()}"` })
        break
      }
    }

    return out
  })
}

async function auditRoute(page: Page, route: string, viewport: string) {
  const consoleErrors: string[] = []
  const failed: string[] = []
  const onConsole = (m: { type: () => string; text: () => string }) => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) consoleErrors.push(m.text())
  }
  const onResponse = (r: { status: () => number; url: () => string }) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  }
  page.on('console', onConsole as never)
  page.on('response', onResponse as never)

  const response = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => null)
  if (!response) {
    add(route, viewport, 'navigation', 'navigation failed')
  } else if (response.status() >= 400) {
    add(route, viewport, 'status', `HTTP ${response.status()}`)
  }
  await page.waitForTimeout(700)

  for (const item of await inspect(page)) add(route, viewport, item.kind, item.detail)
  for (const error of [...new Set(consoleErrors)].slice(0, 3)) add(route, viewport, 'console', error)
  for (const url of [...new Set(failed)].slice(0, 5)) add(route, viewport, 'request', url)

  page.off('console', onConsole as never)
  page.off('response', onResponse as never)
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const adminContext = await signIn(browser, 'admin@laqta.sa')
  const creatorContext = await signIn(browser, 'creator@laqta.sa')

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'phone', width: 390, height: 844 },
  ]

  for (const viewport of viewports) {
    const adminPage = await adminContext.newPage()
    const creatorPage = await creatorContext.newPage()
    await adminPage.setViewportSize({ width: viewport.width, height: viewport.height })
    await creatorPage.setViewportSize({ width: viewport.width, height: viewport.height })
    console.log(`\n── ${viewport.name} (${viewport.width}px) ──`)
    // Both languages (DEV-55): every route in Arabic, then under /en. Set
    // AUDIT_LANGS=ar for a quicker Arabic-only pass.
    const langs = (process.env.AUDIT_LANGS ?? 'ar,en').split(',').map((l) => l.trim()).filter(Boolean)
    for (const lang of langs) {
      for (const base of ROUTES) {
        const route = lang === 'en' ? (base === '/' ? '/en' : `/en${base}`) : base
        const before = findings.length
        const page = base.startsWith('/studio') ? creatorPage : adminPage
        await auditRoute(page, route, viewport.name)
        const count = findings.length - before
        console.log(`  ${count === 0 ? 'clean' : `${count} finding(s)`}  ${route}`)
      }
    }
    await adminPage.close()
    await creatorPage.close()
  }

  await browser.close()

  console.log('\n════ FINDINGS ════')
  if (findings.length === 0) {
    console.log('None. Every route is clean at both widths.')
    process.exit(0)
  }
  const byKind = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, [])
    byKind.get(f.kind)!.push(f)
  }
  for (const [kind, list] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${kind} (${list.length})`)
    // Collapse identical details across routes — one fix, not twenty reports.
    const byDetail = new Map<string, string[]>()
    for (const f of list) {
      if (!byDetail.has(f.detail)) byDetail.set(f.detail, [])
      byDetail.get(f.detail)!.push(`${f.route}@${f.viewport}`)
    }
    for (const [detail, where] of byDetail) {
      console.log(`  · ${detail}`)
      console.log(`      ${where.slice(0, 6).join(', ')}${where.length > 6 ? ` +${where.length - 6} more` : ''}`)
    }
  }
  console.log(`\n${findings.length} finding(s) total.`)
  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
