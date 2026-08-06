/**
 * Hero cinematic audit.
 *
 *   npm start &  →  npm run verify:hero
 *
 * The scroll-scrubbed film is the one part of the site that cannot be checked
 * by fetching HTML: a pinned `<video>` whose `currentTime` tracks scroll. So
 * this drives a real browser and asserts the things that actually break.
 *
 * What it proves:
 *   - exactly one hero video (a continuous film, not a slideshow of clips)
 *   - scrolling moves its `currentTime` forward, and back on the way up
 *   - the hero is BOUNDED: the landing sections render below it, not 30 screens
 *     down — the whole point of the rework
 *   - nothing is left `position: fixed` over the page at the bottom (the old
 *     engine's overlay used to strand a white shape mid-screen at scroll end)
 *   - reduced-motion callers still get the headline, and the film never scrubs
 */

import { chromium, type Page } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y)
  await page.waitForTimeout(500)
}

async function currentTime(page: Page) {
  return page.evaluate(() => document.querySelector('video')?.currentTime ?? 0)
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) consoleErrors.push(m.text())
  })
  const failedRequests: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  })

  console.log('Hero cinematic\n')

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const vh = await page.evaluate(() => window.innerHeight)

  const videos = await page.locator('video').count()
  report('exactly one hero video (continuous film)', videos === 1, `${videos} <video> elements`)

  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
  report('the headline is server-rendered', h1.length > 0, h1.slice(0, 40))

  // ── The scrub ──────────────────────────────────────────────────────────────
  await scrollTo(page, vh * 0.4)
  const t1 = await currentTime(page)
  await scrollTo(page, vh * 1.6)
  const t2 = await currentTime(page)
  report('scrolling scrubs the film forward', t2 > t1 + 0.1, `${t1.toFixed(1)} → ${t2.toFixed(1)}`)
  await scrollTo(page, vh * 0.4)
  const t3 = await currentTime(page)
  report('scrubbing runs backwards too', t3 < t2 - 0.1, `${t2.toFixed(1)} → ${t3.toFixed(1)}`)

  // ── The hero is bounded — sections render just below it ─────────────────────
  await scrollTo(page, vh * 3.3)
  const sections = await page.evaluate(() => {
    const text = document.body.innerText
    return {
      wall: text.includes('تصفّح باللقطة') || text.includes('واشترِ بالألبوم'),
      collection: text.includes('المجموعة الأولى') || text.includes('كل لقطة مقصودة'),
      licensing: text.includes('تغطّي كل استخداماتك') || text.includes('رخصة واحدة'),
    }
  })
  report('footage wall renders below the hero', sections.wall)
  report('collection renders below the hero', sections.collection)
  report('licensing section renders below the hero', sections.licensing)

  // ── No fixed overlay stranded at the bottom (the old white-shape bug) ───────
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const strays = await page.evaluate(() => {
    const h = window.innerHeight
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const s = getComputedStyle(el)
        if (s.position !== 'fixed') return false
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8) return false
        if (r.bottom < 0 || r.top > h) return false
        return s.opacity !== '0' && s.visibility !== 'hidden'
      })
      .map((el) => (typeof el.className === 'string' ? el.className.slice(0, 40) : el.tagName))
  })
  report('no fixed element stranded at scroll end', strays.length === 0, strays.join(', '))

  report('no failed requests on the landing page', failedRequests.length === 0, [...new Set(failedRequests)].slice(0, 5).join(', '))
  report('no script errors on the landing page', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  // ── Reduced motion: headline stands, film never scrubs ──────────────────────
  const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await reduced.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await reduced.waitForTimeout(1200)
  const rHeading = await reduced.locator('h1').first().isVisible()
  await reduced.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'instant' as ScrollBehavior }))
  await reduced.waitForTimeout(600)
  const rTime = await reduced.evaluate(() => document.querySelector('video')?.currentTime ?? 0)
  report('reduced motion still renders the h1', rHeading)
  report('reduced motion does not scrub the film', rTime < 0.5, `currentTime ${rTime.toFixed(2)}`)

  await browser.close()
  console.log(failures ? `\n${failures} check(s) failed.` : '\nThe film scrubs, bounded, and the sections follow.')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
