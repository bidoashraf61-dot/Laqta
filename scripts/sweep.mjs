#!/usr/bin/env node
/**
 * A full-portal sweep, wider than `npm run audit`.
 *
 * `audit` checks each route for script errors, failed requests, unlabelled
 * controls, heading order, overflow and RTL. This adds the things that only
 * show up when you actually try to USE the page:
 *
 *   - internal links that 404
 *   - images that fail to load, or carry no alt
 *   - controls smaller than a finger
 *   - form fields with no accessible name
 *   - `<a>` and `<button>` with no accessible name at all
 *   - text clipped by its own container
 *   - anything that overflows the viewport horizontally
 *
 * Run against a built server. This is a diagnostic, not a gate: it prints
 * everything it finds so a person can decide, rather than exiting non-zero on
 * the first cosmetic nit.
 */

import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? process.env.LAQTA_BASE ?? 'http://localhost:3000'
const PASSWORD = 'Laqta!2026'

const PUBLIC_ROUTES = [
  '/',
  '/albums',
  '/footage',
  '/creators',
  '/collections',
  '/categories',
  '/locations',
  '/sell',
  '/licences',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/content-policy',
  '/cart',
  '/sign-in',
  '/sign-up',
  '/albums/yousef-shami/alula-golden-hour-aerials',
  '/footage/alula-01',
  '/creators/yousef-shami',
  '/collections/saudi-heritage',
  '/en',
  '/en/albums',
  '/en/footage',
  '/en/sell',
  '/en/licences',
]

const AUTHED = [
  {
    email: 'admin@laqta.sa',
    routes: [
      '/admin',
      '/admin/analytics',
      '/admin/review',
      '/admin/catalogue',
      '/admin/orders',
      '/admin/creators',
      '/admin/payouts',
      '/admin/promos',
      '/admin/reports',
      '/admin/settings',
      '/admin/taxonomy',
      '/admin/merchandising',
      '/admin/disputes',
      '/admin/requests',
    ],
  },
  {
    email: 'creator@laqta.sa',
    routes: [
      '/studio',
      '/studio/analytics',
      '/studio/albums',
      '/studio/albums/new',
      '/studio/releases',
      '/studio/earnings',
      '/studio/payouts',
      '/studio/settings',
    ],
  },
  {
    email: 'buyer@agency.sa',
    routes: [
      '/account',
      '/account/library',
      '/account/purchases',
      '/account/downloads',
      '/account/boards',
      '/account/security',
    ],
  },
]

const PROBE = () => {
  const out = {
    images: [],
    controls: [],
    fields: [],
    clipped: [],
    overflow: null,
    decorative: null,
    links: [],
  }

  for (const img of document.querySelectorAll('img')) {
    const rect = img.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    /*
     * `complete` first. A lazy image below the fold has naturalWidth 0 because
     * it has not been REQUESTED yet, not because it is broken — the first run
     * of this sweep reported eight perfectly good album posters as failures on
     * exactly that basis, and all eight serve 200.
     */
    if (img.complete && img.naturalWidth === 0) {
      out.images.push({ issue: 'failed to load', src: img.currentSrc || img.src })
    }
    // `alt=""` is correct for decoration; a MISSING alt attribute is not.
    else if (!img.hasAttribute('alt'))
      out.images.push({ issue: 'no alt attribute', src: img.currentSrc || img.src })
  }

  const name = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || '').trim()

  for (const el of document.querySelectorAll('a, button, [role="button"]')) {
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    if (!name(el) && !el.querySelector('img[alt]:not([alt=""])')) {
      out.controls.push({
        issue: 'no accessible name',
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 40),
      })
    }
    /*
     * WCAG 2.2 SC 2.5.8 asks for 24×24 CSS px. Inline links inside running
     * prose are exempt by the spec — they are words in a sentence, not targets
     * — but a link in a footer LIST is a target and does not get that exemption
     * just because it happens to sit in an <li>.
     */
    const inSentence = el.closest('p, dd, figcaption')
    if (!inSentence && (rect.height < 24 || rect.width < 24)) {
      out.controls.push({
        issue: `small target ${Math.round(rect.width)}×${Math.round(rect.height)}`,
        tag: el.tagName,
        text: name(el).slice(0, 30),
      })
    }
  }

  for (const field of document.querySelectorAll('input, select, textarea')) {
    if (field.type === 'hidden') continue
    const labelled =
      field.labels?.length ||
      field.getAttribute('aria-label') ||
      field.getAttribute('aria-labelledby') ||
      field.getAttribute('placeholder')
    if (!labelled) out.fields.push({ name: field.getAttribute('name') || field.type })
  }

  // Text taller than the box drawn for it.
  for (const el of document.querySelectorAll('h1, h2, h3, p, span, dd, dt, li')) {
    if (el.children.length) continue
    const style = getComputedStyle(el)
    if (style.overflow === 'visible') continue
    if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') continue
    if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
      out.clipped.push({
        text: (el.innerText || '').slice(0, 40),
        by: el.scrollHeight - el.clientHeight,
      })
    }
  }

  /*
   * Decorative DOM, counted.
   *
   * The preview watermark repeats a wordmark to tile a frame, and it is drawn
   * on every card, tile and player. At 48 repeats the landing page carried
   * 1,392 spans — 64% of the document — and Safari scrolled it at three frames
   * per second while Chrome showed nothing wrong at all. A node budget is the
   * cheapest way to notice that happening again without running WebKit in CI.
   */
  const decorative = document.querySelectorAll('[aria-hidden].select-none span').length
  const allNodes = document.querySelectorAll('*').length
  if (decorative > 400 || (allNodes > 1500 && decorative / allNodes > 0.4)) {
    out.decorative = { spans: decorative, ofTotal: `${Math.round((decorative / allNodes) * 100)}%` }
  }

  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    out.overflow = {
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }
  }

  out.links = [
    ...new Set(
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && h.startsWith('/') && !h.startsWith('//')),
    ),
  ]

  return out
}

const browser = await chromium.launch({ channel: 'chrome' })

async function signIn(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(BASE + '/sign-in', { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page
    .waitForURL((u) => !u.pathname.includes('/sign-in'), { timeout: 25_000 })
    .catch(() => {})
  await page.close()
  return context
}

const findings = []
const allLinks = new Set()

async function sweep(context, routes, label) {
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 160)))
  page.on('requestfailed', (r) => {
    /*
     * `?_rsc=` aborts are Next PREFETCHES, cancelled when the reader navigates
     * before they land. That is the router working, not a broken request — and
     * counting them buried 481 real findings under 374 pieces of noise on the
     * first run of this sweep.
     */
    if (r.url().includes('_rsc=')) return
    failedRequests.push(`${r.url().slice(0, 110)} — ${r.failure()?.errorText}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) {
      failedRequests.push(`${r.status()} ${r.url().slice(0, 110)}`)
    }
  })

  for (const route of routes) {
    consoleErrors.length = 0
    failedRequests.length = 0
    const response = await page
      .goto(BASE + route, { waitUntil: 'domcontentloaded' })
      .catch(() => null)
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.waitForTimeout(500)

    const status = response?.status() ?? 0
    const probe = await page.evaluate(PROBE).catch(() => null)
    if (probe) probe.links.forEach((l) => allLinks.add(l))

    const issues = []
    if (status >= 400) issues.push(`HTTP ${status}`)
    consoleErrors.forEach((e) => issues.push(`console: ${e}`))
    failedRequests.forEach((e) => issues.push(`request: ${e}`))
    probe?.images.forEach((i) => issues.push(`image ${i.issue}: ${(i.src || '').slice(0, 70)}`))
    probe?.controls.forEach((c) =>
      issues.push(`control ${c.issue} <${c.tag}> ${c.text ?? c.cls ?? ''}`),
    )
    probe?.fields.forEach((f) => issues.push(`field with no label: ${f.name}`))
    probe?.clipped.forEach((c) => issues.push(`text clipped by ${c.by}px: "${c.text}"`))
    if (probe?.overflow)
      issues.push(`horizontal overflow: ${probe.overflow.scrollWidth} > ${probe.overflow.viewport}`)

    if (issues.length) findings.push({ route: `${label}${route}`, issues })
    console.log(
      `  ${issues.length ? 'ISSUES' : 'clean '}  ${label}${route}${issues.length ? ` (${issues.length})` : ''}`,
    )
  }
  await page.close()
}

console.log('\n── public ──')
const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await sweep(anon, PUBLIC_ROUTES, '')
await anon.close()

for (const { email, routes } of AUTHED) {
  console.log(`\n── ${email} ──`)
  const context = await signIn(email)
  await sweep(context, routes, '')
  await context.close()
}

// ── Every internal link, resolved ─────────────────────────────────────────
console.log('\n── link check ──')
const anon2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const linkPage = await anon2.newPage()
const broken = []
for (const href of [...allLinks].sort()) {
  const url = BASE + href
  const res = await linkPage.request.get(url, { maxRedirects: 5 }).catch(() => null)
  const status = res?.status() ?? 0
  // 307 to sign-in is a working guard, not a broken link.
  if (status >= 400) broken.push(`${status} ${href}`)
}
console.log(`  ${broken.length ? 'BROKEN' : 'clean '}  ${allLinks.size} internal links checked`)
broken.forEach((b) => console.log(`         ${b}`))
await anon2.close()
await browser.close()

console.log('\n════ SUMMARY ════')
if (!findings.length && !broken.length) {
  console.log('No issues found.')
} else {
  for (const f of findings) {
    console.log(`\n${f.route}`)
    ;[...new Set(f.issues)].forEach((i) => console.log(`   • ${i}`))
  }
  if (broken.length) {
    console.log('\nBroken internal links')
    broken.forEach((b) => console.log(`   • ${b}`))
  }
}
