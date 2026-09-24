import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? process.env.LAQTA_BASE ?? 'http://localhost:3000'
const PUBLIC_ROUTES = ['/', '/albums', '/footage', '/sell', '/licences', '/about', '/terms',
                       '/creators', '/collections', '/contact', '/cart', '/sign-in',
                       '/en', '/en/albums', '/en/sell', '/en/licences']

/** The three dashboards. Arabic-only. */
const AUTHED = [
  { email: 'admin@laqta.sa', routes: ['/admin', '/admin/analytics', '/admin/review', '/admin/catalogue', '/admin/orders', '/admin/payouts', '/admin/settings'] },
  { email: 'creator@laqta.sa', routes: ['/studio', '/studio/analytics', '/studio/albums', '/studio/earnings', '/studio/settings'] },
  { email: 'buyer@agency.sa', routes: ['/account', '/account/library', '/account/purchases', '/account/downloads', '/account/security'] },
]

async function signIn(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/sign-in', { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', 'Laqta!2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.includes('/sign-in'), { timeout: 20_000 }).catch(() => {})
  await page.close()
  return ctx
}

const PROBE = () => {
  const lum = (r, g, b) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const parse = s => (s.match(/[\d.]+/g) || []).map(Number)
  /*
   * True when the text sits over imagery or a gradient rather than a flat fill.
   *
   * A computed style exposes `backgroundColor` but tells us nothing about what
   * a photo, a `background-image`, or an absolutely-positioned scrim sibling
   * actually puts behind a glyph. Measuring those as if the page ground were
   * behind them produced 200+ confident, wrong failures on the album packs —
   * a gate nobody would trust twice. These are counted and reported, never
   * failed: they need an eye, not a number.
   */
  const overImagery = el => {
    // Only what lies BETWEEN the glyph and the first opaque fill can affect it.
    // Walking all the way to <body> marks every element on any page that has a
    // gradient anywhere above it — which was 10,404 of them, i.e. the check
    // silently excused the whole site instead of the packs.
    let n = el
    while (n && n !== document.body) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true
      const kids = n.parentElement ? [...n.parentElement.children] : []
      if (kids.some(k => k !== n && getComputedStyle(k).position === 'absolute' &&
                          (getComputedStyle(k).backgroundImage !== 'none' ||
                           k.querySelector('img, video, picture')))) return true
      const bg = parse(cs.backgroundColor)
      if (bg.length && (bg[3] === undefined || bg[3] === 1)) return false
      n = n.parentElement
    }
    return false
  }

  const effBg = el => {
    const stack = []; let n = el
    while (n) {
      const p = parse(getComputedStyle(n).backgroundColor)
      if (p.length && (p[3] === undefined || p[3] > 0)) { stack.push(p); if (p[3] === undefined || p[3] === 1) break }
      n = n.parentElement
    }
    const root = parse(getComputedStyle(document.documentElement).backgroundColor)
    let [r, g, b] = root.length && root[3] !== 0 ? root : [255, 255, 255]
    for (let i = stack.length - 1; i >= 0; i--) { const [pr, pg, pb, pa = 1] = stack[i]; r = pr * pa + r * (1 - pa); g = pg * pa + g * (1 - pa); b = pb * pa + b * (1 - pa) }
    return [r, g, b]
  }
  const ratio = (f, b) => { const [x, y] = [lum(...f) + 0.05, lum(...b) + 0.05]; return +(Math.max(x, y) / Math.min(x, y)).toFixed(2) }

  const bad = []
  let unmeasurable = 0
  document.querySelectorAll('h1,h2,h3,h4,p,span,a,li,button,label,td,th,legend').forEach(el => {
    const t = (el.textContent || '').trim()
    if (!t || t.length < 3) return
    // NOTE: deliberately NOT gated on offsetParent. Below-the-fold sections are
    // where the invisible-text bug lived, and an offsetParent guard skips them.
    if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') return
    if (el.querySelector('h1,h2,h3,h4,p,span,a,li,button,label')) return
    const cs = getComputedStyle(el)
    const fgp = parse(cs.color); if (!fgp.length) return
    if (parseFloat(cs.opacity) === 0) return
    if (overImagery(el)) { unmeasurable++; return }
    const bg = effBg(el)
    const a = fgp[3] === undefined ? 1 : fgp[3]
    const fg = [fgp[0] * a + bg[0] * (1 - a), fgp[1] * a + bg[1] * (1 - a), fgp[2] * a + bg[2] * (1 - a)]
    const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700
    const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5
    const r = ratio(fg, bg)
    if (r < need) bad.push({ r, need, px: cs.fontSize, bg: `rgb(${bg.map(Math.round).join(',')})`, fg: cs.color, text: t.slice(0, 32) })
  })
  return { bad: [...new Map(bad.map(b => [b.text + b.r, b])).values()].sort((x, y) => x.r - y.r), unmeasurable }
}

const browser = await chromium.launch({ channel: 'chrome' })
let failures = 0
let skipped = 0
/*
 * One theme. `.dark` survives as a SCOPE — the header, the dashboard shells,
 * the hero, a footage placeholder — so dark type is still measured on every
 * route; it is just no longer a second whole-document pass.
 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  for (const route of PUBLIC_ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    const { bad, unmeasurable } = await page.evaluate(PROBE)
    failures += bad.length
    skipped += unmeasurable
    const tag = bad.length === 0 ? 'PASS' : 'FAIL'
    console.log(`  ${tag}  ${route}${bad.length ? ` — ${bad.length}` : ''}`)
    bad.slice(0, 6).forEach(b => console.log(`         ${b.r}:1 (needs ${b.need}) ${b.px} ${b.fg} on ${b.bg} — "${b.text}"`))
  }
  await ctx.close()

  for (const { email, routes } of AUTHED) {
    const authed = await signIn(browser, email)
    const p = await authed.newPage()
    for (const route of routes) {
      await p.goto(BASE + route, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(600)
      const { bad, unmeasurable } = await p.evaluate(PROBE)
      failures += bad.length
      skipped += unmeasurable
      console.log(`  ${bad.length === 0 ? 'PASS' : 'FAIL'}  ${route}${bad.length ? ` — ${bad.length}` : ''}`)
      bad.slice(0, 6).forEach(b => console.log(`         ${b.r}:1 (needs ${b.need}) ${b.px} ${b.fg} on ${b.bg} — "${b.text}"`))
    }
    await authed.close()
  }
}
await browser.close()
console.log(
  failures === 0
    ? `\nEvery measurable text run clears WCAG AA. ${skipped} run(s) over imagery were not measured.`
    : `\n${failures} contrast failure(s). ${skipped} run(s) over imagery were not measured.`,
)
process.exitCode = failures === 0 ? 0 : 1
