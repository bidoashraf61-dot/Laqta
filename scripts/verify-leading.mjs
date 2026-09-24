#!/usr/bin/env node
/**
 * No heading anywhere may have its lines run into each other.
 *
 * ── Why this needs a machine ────────────────────────────────────────────────
 * Thmanyah Serif Display draws Arabic in an ink box about 1.25em tall: alif,
 * lam and kaf reach well above the x-height, and jim, ha, ain, mim, ya and nun
 * hang well below it. Latin does not do this — a Latin face at `line-height:
 * 1.12` looks tight but legal, which is why 1.12 shipped and why nobody caught
 * that the hero's lines were overlapping by 9.4px at desktop size.
 *
 * The failure is invisible to every other check the portal has. Contrast is
 * fine. The audit is clean. The HTML is correct. It is purely a matter of two
 * ink boxes occupying the same pixels, and the only way to know is to measure
 * the boxes.
 *
 * ── What it measures ────────────────────────────────────────────────────────
 * For every h1/h2/h3 on the route, the client rects of each rendered line, and
 * the vertical gap between consecutive ones. A negative gap is an overlap and
 * a failure. Zero is a failure too — glyphs exactly touching still read as
 * collision — so a small positive floor is required.
 *
 * Run at two widths, because a heading that fits on one line at desktop wraps
 * on a phone, and the overlap only exists once it wraps.
 */

import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? process.env.LAQTA_BASE ?? 'http://localhost:3000'

/** Routes with the most headline variety — display, headline, lg and page titles. */
const ROUTES = [
  '/',
  '/albums',
  '/footage',
  '/sell',
  '/licences',
  '/about',
  '/creators',
  '/collections',
  '/en',
  '/en/albums',
  '/en/sell',
]

const WIDTHS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'phone', width: 390, height: 844 },
]

/** Lines closer than this read as touching even when they do not strictly overlap. */
const MIN_GAP_PX = 1

const PROBE = (minGap) => {
  const findings = []
  const range = document.createRange()

  for (const heading of document.querySelectorAll('h1, h2, h3')) {
    /*
     * Measure TEXT NODES, not elements.
     *
     * An earlier version selected the heading's child elements, which meant a
     * heading like `<h3 class="flex items-center"><svg/>Text</h3>` reported the
     * icon's box as a "line" and compared it against the text's — an icon
     * vertically centred beside 28px text looks exactly like a 21px overlap.
     * Two false failures per route, and both of them looked serious.
     *
     * A line of text is a text node's client rect. Nothing else is.
     */
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
    const lines = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.height < 2 || rect.width < 2) continue
        lines.push({ top: rect.top, bottom: rect.bottom })
      }
    }
    if (lines.length < 2) continue

    lines.sort((a, b) => a.top - b.top || a.bottom - b.bottom)
    let worst = null
    for (let i = 1; i < lines.length; i++) {
      // Rects on the same visual line (side-by-side spans) share a top; skip.
      if (Math.abs(lines[i].top - lines[i - 1].top) < 2) continue
      const gap = lines[i].top - lines[i - 1].bottom
      if (gap < minGap && (worst === null || gap < worst)) worst = gap
    }
    if (worst !== null) {
      findings.push({
        tag: heading.tagName,
        gap: +worst.toFixed(1),
        fontSize: getComputedStyle(heading).fontSize,
        lineHeight: getComputedStyle(heading).lineHeight,
        text: heading.innerText.replace(/\s+/g, ' ').trim().slice(0, 60),
      })
    }
  }
  return findings
}

const browser = await chromium.launch({ channel: 'chrome' })
let failures = 0

for (const viewport of WIDTHS) {
  console.log(`\n── ${viewport.label} (${viewport.width}px) ──`)
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    // Webfonts decide the ink box; measuring before they land measures the
    // fallback, which has entirely different metrics.
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(250)

    const findings = await page.evaluate(PROBE, MIN_GAP_PX)
    failures += findings.length
    console.log(`  ${findings.length ? 'FAIL' : 'pass'}  ${route}`)
    for (const f of findings) {
      console.log(`        ${f.tag} ${f.gap}px gap  (${f.fontSize}/${f.lineHeight})  "${f.text}"`)
    }
  }
  await context.close()
}

await browser.close()

console.log()
if (failures) {
  console.error(
    `${failures} heading(s) with lines touching or overlapping.\n` +
      'Thmanyah Serif Display needs at least 1.25 line-height for Arabic — see\n' +
      'the fontSize tokens in tailwind.config.ts.',
  )
  process.exit(1)
}
console.log('No heading has lines running into each other, at either width.')
