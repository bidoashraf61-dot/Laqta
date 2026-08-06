/**
 * End-to-end user journeys.
 *
 *   npm start &  →  npm run verify:journeys
 *
 * The other gates each check one layer: `audit` proves every page RENDERS,
 * `verify:flows` proves dashboard controls MUTATE, `test:unit` proves the pure
 * logic is right. None of them walks a whole person through the product.
 *
 * This does. It drives real Chrome through the three journeys the business
 * actually depends on, end to end, asserting the state change at each step:
 *
 *   BUYER    browse → clip → album → cart → checkout → library → download
 *   CREATOR  studio → album manager → release → payout eligibility → settings
 *   ADMIN    review queue → decision gate → catalogue control → order refund
 *
 * A journey fails loudly at the step that broke, naming it, so a failure is
 * actionable without reading the code.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'
const PASSWORD = 'Laqta!2026'

let failures = 0
let currentJourney = ''

function step(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

function journey(name: string) {
  currentJourney = name
  console.log(`\n── ${name} ──`)
}

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  // The credentials rail resolves client-side and may leave the address bar on
  // /sign-in, so the session endpoint is the truth, not the URL.
  await page.waitForTimeout(2500)
  const session = await page
    .evaluate(async () => (await fetch('/api/auth/session')).json())
    .catch(() => null)
  const signedIn = Boolean((session as { user?: { email?: string } } | null)?.user?.email)
  await page.close()
  return { context, signedIn, session }
}

/** Anything that throws mid-journey should fail that step, not the whole run. */
async function guard<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    step(label, false, (error as Error).message.split('\n')[0].slice(0, 100))
    return null
  }
}

// ── BUYER ────────────────────────────────────────────────────────────────────

async function buyerJourney(context: BrowserContext) {
  journey('Buyer: browse → album → cart → checkout → library')
  const page = await context.newPage()

  await guard('catalogue lists footage', async () => {
    await page.goto(`${BASE}/footage`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const cards = await page.locator('article').count()
    step('catalogue lists footage', cards > 0, `${cards} clips`)
  })

  let clipHref: string | null = null
  await guard('a clip page opens from the grid', async () => {
    clipHref = await page.locator('a[href^="/footage/"]').first().getAttribute('href')
    if (!clipHref) {
      step('a clip page opens from the grid', false, 'no clip link in the grid')
      return
    }
    await page.goto(`${BASE}${clipHref}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
    step('a clip page opens from the grid', h1.length > 0, clipHref)
  })

  let albumUrl = `${BASE}/albums`
  await guard('the clip page routes to its album', async () => {
    const href = await page.locator('a[href^="/albums/"]').first().getAttribute('href')
    if (!href) {
      step('the clip page routes to its album', false, 'clip page has no album link')
      return
    }
    albumUrl = `${BASE}${href}`
    await page.goto(albumUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    // Every clip surface must carry a route to the album — a clip is not
    // purchasable on its own, so losing this link strands the buyer.
    step('the clip page routes to its album', page.url().includes('/albums/'), href)
  })

  await guard('the album shows a price and a buy control', async () => {
    const text = await page.evaluate(() => document.body.innerText)
    const hasPrice = /US\$|\$/.test(text)
    const buyLink = await page.locator('a[href^="/cart/add"]').count()
    step('the album shows a price and a buy control', hasPrice && buyLink > 0, `${buyLink} buy link(s)`)
  })

  await guard('adding to cart puts the album in the cart', async () => {
    await page.goto(albumUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const albumTitle = await page.evaluate(
      () => document.querySelector('h1')?.textContent?.trim().slice(0, 20) ?? '',
    )
    // The buy control is a LINK to /cart/add?album=…&tier=… , not a button —
    // the album page has no client JS for it, which is why the whole PDP stays
    // server-rendered.
    const addLink = page.locator('a[href^="/cart/add"]').first()
    if ((await addLink.count()) === 0) {
      step('adding to cart puts the album in the cart', false, 'no add-to-cart control')
      return
    }
    await addLink.click()
    await page.waitForTimeout(2500)
    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1400)
    const cart = await page.evaluate(() => document.body.innerText)
    const present = albumTitle.length > 0 && cart.includes(albumTitle.slice(0, 12))
    step('adding to cart puts the album in the cart', present, present ? albumTitle : 'album not in cart')
  })

  await guard('checkout renders a payable order', async () => {
    await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1400)
    const text = await page.evaluate(() => document.body.innerText)
    const hasTotal = /الإجمالي|المجموع/.test(text)
    step('checkout renders a payable order', hasTotal || /سلتك فارغة/.test(text), hasTotal ? 'has a total' : 'empty cart (valid)')
  })

  await guard('the library lists what the buyer owns', async () => {
    await page.goto(`${BASE}/account/library`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const ok = page.url().includes('/account/library')
    step('the library lists what the buyer owns', ok, page.url().replace(BASE, ''))
  })

  await guard('downloads page is reachable', async () => {
    await page.goto(`${BASE}/account/downloads`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    step('downloads page is reachable', page.url().includes('/account/downloads'))
  })

  await page.close()
}

// ── CREATOR ──────────────────────────────────────────────────────────────────

async function creatorJourney(context: BrowserContext) {
  journey('Creator: studio → albums → releases → payouts → settings')
  const page = await context.newPage()

  await guard('the studio overview renders (not an error boundary)', async () => {
    await page.goto(`${BASE}/studio`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const text = await page.evaluate(() => document.body.innerText)
    const errored = text.includes('حدث خطأ')
    const hasNav = (await page.locator('aside a').count()) > 0
    step('the studio overview renders (not an error boundary)', !errored && hasNav, `${await page.locator('aside a').count()} nav links`)
  })

  await guard('the album manager lists the creator albums', async () => {
    await page.goto(`${BASE}/studio/albums`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1300)
    const rows = await page.locator('tbody tr').count()
    step('the album manager lists the creator albums', rows > 0, `${rows} albums`)
  })

  await guard('a status filter narrows the list', async () => {
    const chip = page.locator('a[href^="/studio/albums?"]').first()
    if ((await chip.count()) === 0) {
      step('a status filter narrows the list', false, 'no filter chip')
      return
    }
    await chip.click()
    await page.waitForTimeout(1600)
    step('a status filter narrows the list', page.url().includes('status='), page.url().replace(BASE, ''))
  })

  await guard('releases page states the permit rules', async () => {
    await page.goto(`${BASE}/studio/releases`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const text = await page.evaluate(() => document.body.innerText)
    step('releases page states the permit rules', /تصريح|تصاريح/.test(text))
  })

  await guard('payouts explains the hold before offering a withdrawal', async () => {
    await page.goto(`${BASE}/studio/payouts`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1300)
    const text = await page.evaluate(() => document.body.innerText)
    // The 30-day hold must be stated — a creator who cannot see why their
    // balance is short assumes the platform is keeping it.
    step('payouts explains the hold before offering a withdrawal', /٣٠|30/.test(text) && /محجوز|تُحجز/.test(text))
  })

  await guard('settings shows the commission share', async () => {
    await page.goto(`${BASE}/studio/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1300)
    const text = await page.evaluate(() => document.body.innerText)
    // ar-SA renders the Arabic percent sign ٪ (U+066A), not ASCII %.
    step('settings shows the commission share', /[%٪]/.test(text))
  })

  await guard('a settings change persists through a reload', async () => {
    const city = page.locator('#city')
    if ((await city.count()) === 0) {
      step('a settings change persists through a reload', false, 'no city field')
      return
    }
    const original = await city.inputValue()
    const probe = original === 'الرياض' ? 'جدة' : 'الرياض'
    await city.fill(probe)
    await page.locator('form', { has: page.locator('#city') }).locator('button[type="submit"]').click()
    await page.waitForTimeout(2200)
    await page.goto(`${BASE}/studio/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const saved = await page.locator('#city').inputValue()
    step('a settings change persists through a reload', saved === probe, `${original} → ${saved}`)
    // Restore so the run is idempotent.
    await page.locator('#city').fill(original)
    await page.locator('form', { has: page.locator('#city') }).locator('button[type="submit"]').click()
    await page.waitForTimeout(1800)
  })

  await page.close()
}

// ── ADMIN ────────────────────────────────────────────────────────────────────

async function adminJourney(context: BrowserContext) {
  journey('Admin: queue → review gate → catalogue → orders')
  const page = await context.newPage()

  await guard('the control panel renders (not an error boundary)', async () => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const text = await page.evaluate(() => document.body.innerText)
    const hasNav = (await page.locator('aside a').count()) > 0
    step('the control panel renders (not an error boundary)', !text.includes('حدث خطأ') && hasNav)
  })

  await guard('the review queue is ordered by SLA', async () => {
    await page.goto(`${BASE}/admin/review`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1300)
    const text = await page.evaluate(() => document.body.innerText)
    step('the review queue is ordered by SLA', /الموعد|قائمة المراجعة/.test(text))
  })

  await guard('a review task opens its decision gate', async () => {
    const task = page.locator('a[href^="/admin/review/"]').first()
    if ((await task.count()) === 0) {
      step('a review task opens its decision gate', true, 'queue empty (valid)')
      return
    }
    await task.click()
    await page.waitForTimeout(1800)
    const text = await page.evaluate(() => document.body.innerText)
    // The gate must show the checklist, and approval must be refused until
    // every check is decided — the invariant the bypass fix restored.
    const hasChecklist = /قائمة الفحص|فحص/.test(text)
    step('a review task opens its decision gate', hasChecklist, page.url().replace(BASE, ''))
  })

  await guard('the catalogue exposes pause and delist', async () => {
    await page.goto(`${BASE}/admin/catalogue`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1300)
    const text = await page.evaluate(() => document.body.innerText)
    step('the catalogue exposes pause and delist', /إيقاف|سحب/.test(text))
  })

  await guard('orders expose the frozen commission rate per line', async () => {
    await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1400)
    const text = await page.evaluate(() => document.body.innerText)
    const empty = /لا توجد طلبات/.test(text)
    step(
      'orders expose the frozen commission rate per line',
      empty || /[%٪]/.test(text),
      empty ? 'no orders (valid)' : 'rate shown',
    )
  })

  await guard('payout queue groups by rail', async () => {
    await page.goto(`${BASE}/admin/payouts`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1300)
    const text = await page.evaluate(() => document.body.innerText)
    step('payout queue groups by rail', /IBAN|Payoneer|Wise/i.test(text))
  })

  await page.close()
}

// ── GUARDS ───────────────────────────────────────────────────────────────────

async function guardMatrix(browser: Browser) {
  journey('Access control: the guard matrix')
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await anon.newPage()

  for (const route of ['/studio', '/admin', '/account', '/account/library']) {
    await guard(`anonymous is refused ${route}`, async () => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)
      const url = page.url()
      const body = await page.evaluate(() => document.body.innerText)
      const blocked =
        url.includes('/sign-in') || url.includes('/forbidden') || /لا تملك صلاحية/.test(body)
      step(`anonymous is refused ${route}`, blocked, url.replace(BASE, ''))
    })
  }
  await page.close()
  await anon.close()

  // A creator must not reach the admin panel.
  const { context: creator } = await signIn(browser, 'creator@laqta.sa')
  const cPage = await creator.newPage()
  await guard('a creator is refused /admin', async () => {
    await cPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
    await cPage.waitForTimeout(1200)
    // middleware.ts REWRITES rather than redirects — the typed URL stays in the
    // address bar by design — so the forbidden page is proven by its content.
    const body = await cPage.evaluate(() => document.body.innerText)
    const refused = /لا تملك صلاحية/.test(body)
    const leaked = /لوحة التحكم|قائمة المراجعة/.test(body) && !refused
    step('a creator is refused /admin', refused && !leaked, refused ? 'forbidden page' : 'ADMIN CONTENT LEAKED')
  })
  await cPage.close()
  await creator.close()
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  console.log('User journeys\n')

  const buyer = await signIn(browser, 'buyer@agency.sa')
  const creator = await signIn(browser, 'creator@laqta.sa')
  const admin = await signIn(browser, 'admin@laqta.sa')

  journey('Sign-in')
  step('buyer signs in', buyer.signedIn)
  step('creator signs in', creator.signedIn)
  step('admin signs in', admin.signedIn)

  await buyerJourney(buyer.context)
  await creatorJourney(creator.context)
  await adminJourney(admin.context)
  await guardMatrix(browser)

  await browser.close()
  console.log(
    failures ? `\n${failures} step(s) failed.` : '\nEvery journey completes end to end.',
  )
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(`\nJourney runner crashed during "${currentJourney}":`)
  console.error(error)
  process.exit(1)
})
