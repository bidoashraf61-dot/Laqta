/**
 * Hero cinematic audit.
 *
 *   npm start &  →  npm run verify:hero
 *
 * The scroll-scrubbed film is the one part of the site that cannot be checked
 * by fetching HTML: it mounts from a dynamic import, builds its segment chain
 * in JS, loads each clip as a Blob and drives `currentTime` from scroll. So
 * this drives a real browser and asserts the things that actually break.
 *
 * What it proves:
 *   - the engine mounts and builds the full dive/connector chain
 *   - every connector clip resolves (a 404 degrades silently to a poster,
 *     which is exactly the failure you would never notice by looking)
 *   - scrolling moves a video's `currentTime` — the scrub is live, not frozen
 *   - scrubbing backwards works, and a fast flick does not wedge the decoder
 *   - reduced-motion callers get the static fallback, not a dead scroller
 */

import { chromium, type Page } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

/** Scroll the window and let the engine's rAF loop settle. */
async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y)
  await page.waitForTimeout(320)
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  // Track every failed request, not just hero assets: a console error reading
  // "failed to load resource" names nothing, and a 404 you cannot identify is
  // a 404 you cannot fix.
  const failedRequests: string[] = []
  const failedHeroRequests: string[] = []
  page.on('response', (response) => {
    if (response.status() < 400) return
    const url = response.url()
    failedRequests.push(`${response.status()} ${url.replace(BASE, '')}`)
    if (url.includes('/hero/vid/')) failedHeroRequests.push(`${response.status()} ${url.split('/').pop()}`)
  })

  console.log('Hero cinematic\n')

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  // The engine mounts from a dynamic import inside an effect.
  await page.waitForSelector('.sw-root', { timeout: 15_000 }).catch(() => {})

  const mounted = await page.locator('.sw-root').count()
  report('engine mounts', mounted > 0)

  const scenes = await page.locator('.sw-scene').count()
  // 14 dives + 12 connectors; connector 07 is deliberately absent.
  report('full segment chain built', scenes === 26, `${scenes} segments (expected 26)`)

  // Walk the page so every clip gets a chance to load and paint.
  const height = await page.evaluate(() => document.body.scrollHeight)
  for (let i = 1; i <= 12; i++) await scrollTo(page, (height / 12) * i)

  const videos = await page.locator('.sw-scene__video').count()
  report('connector clips attached', videos >= 12, `${videos} <video> elements`)

  report('no hero asset 404s', failedHeroRequests.length === 0, failedHeroRequests.join(', '))

  // ── The scrub itself ───────────────────────────────────────────────────────
  await scrollTo(page, height * 0.18)
  const before = await page.evaluate(() => {
    const list = [...document.querySelectorAll('video')] as HTMLVideoElement[]
    return list.map((v) => v.currentTime)
  })
  await scrollTo(page, height * 0.26)
  const after = await page.evaluate(() => {
    const list = [...document.querySelectorAll('video')] as HTMLVideoElement[]
    return list.map((v) => v.currentTime)
  })
  const moved = before.some((t, i) => after[i] !== undefined && Math.abs(after[i] - t) > 0.01)
  report('scrolling scrubs the film', moved, `${before.length} videos sampled`)

  await scrollTo(page, height * 0.18)
  const back = await page.evaluate(() => {
    const list = [...document.querySelectorAll('video')] as HTMLVideoElement[]
    return list.map((v) => v.currentTime)
  })
  const rewound = after.some((t, i) => back[i] !== undefined && Math.abs(back[i] - t) > 0.01)
  report('scrubbing runs backwards too', rewound)

  // A fast flick is what wedges a decoder — the engine drops seeks while one
  // is in flight, so the playhead must still be tracking afterwards.
  for (const fraction of [0.9, 0.2, 0.75, 0.35, 0.6]) await scrollTo(page, height * fraction)
  const alive = await page.evaluate(() => {
    const list = [...document.querySelectorAll('video')] as HTMLVideoElement[]
    return list.filter((v) => v.readyState >= 2).length
  })
  report('survives a fast flick', alive > 0, `${alive} videos still decodable`)

  // Resource 404s surface as console errors too, so name them explicitly and
  // report anything left over separately.
  report('no failed requests on the landing page', failedRequests.length === 0, [...new Set(failedRequests)].slice(0, 6).join(', '))
  const otherErrors = consoleErrors.filter((line) => !/Failed to load resource/i.test(line))
  report('no script errors on the landing page', otherErrors.length === 0, otherErrors.slice(0, 3).join(' | '))

  // ── Reduced motion gets the static fallback ───────────────────────────────
  const reduced = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  await reduced.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await reduced.waitForTimeout(1200)
  const engineMounted = await reduced.locator('.sw-root').count()
  const headingVisible = await reduced.locator('h1').first().isVisible()
  report('reduced motion skips the engine', engineMounted === 0)
  report('reduced motion still renders the h1', headingVisible)

  await browser.close()

  console.log(failures ? `\n${failures} check(s) failed.` : '\nThe film scrubs.')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
