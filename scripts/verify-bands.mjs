#!/usr/bin/env node
/**
 * No two adjacent full-width bands may share a background.
 *
 * ── Why this needs a machine ────────────────────────────────────────────────
 * The landing page ended with the footage-request band and the final call to
 * action both set to olive, one directly above the other, and the site footer
 * is olive too — three identical bands in a row, so the page's last third read
 * as one undivided block with no way to see that a new argument had started.
 *
 * Nothing catches that by reading the code: each section names a tone that is
 * individually correct, and the fault only exists in the ADJACENCY. You have to
 * look at the rendered page, in order, and compare each band to the one above.
 *
 * ── What it measures ────────────────────────────────────────────────────────
 * The computed background of every `<section>` that spans the viewport, in
 * document order, and whether two consecutive ones are the same colour.
 *
 * Sections that do not span the full width are skipped: a card is a section
 * too, and two cards sharing a background is the entire point of a grid.
 */

import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE_URL ?? process.env.LAQTA_BASE ?? 'http://localhost:3000'

/** Pages built from stacked full-width bands. */
const ROUTES = ['/', '/sell', '/en', '/en/sell']

const PROBE = () => {
  const bands = []
  for (const section of document.querySelectorAll('section')) {
    const rect = section.getBoundingClientRect()
    // Full-bleed only. A card is a <section> too.
    if (rect.width < window.innerWidth * 0.9) continue
    if (rect.height < 80) continue

    /*
     * Leaf bands only.
     *
     * The scroll deck is a <section> that CONTAINS three <section> panels, so a
     * container and its own child were being compared against each other and
     * reported as a clash with themselves. A wrapper is not a band; the thing
     * that paints the ground is.
     */
    if (section.querySelector('section')) continue

    /*
     * A transparent band is still a band — it shows the page ground.
     *
     * Skipping them was wrong and produced a false failure immediately: on
     * /sell a sand band, a transparent one, and another sand band became
     * "adjacent sand" once the middle one was dropped, when in fact the page
     * alternates correctly. Resolve transparent to whatever is actually
     * painted behind it.
     */
    const own = getComputedStyle(section).backgroundColor
    const background =
      own && own !== 'rgba(0, 0, 0, 0)' ? own : getComputedStyle(document.body).backgroundColor

    bands.push({
      background,
      label: (section.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 44),
    })
  }

  const clashes = []
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].background === bands[i - 1].background) {
      clashes.push({
        background: bands[i].background,
        first: bands[i - 1].label,
        second: bands[i].label,
      })
    }
  }
  return { count: bands.length, clashes }
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

let failures = 0
for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => document.fonts.ready)
  // The scroll deck pins its panels; reveal everything so every band is laid
  // out before measuring.
  await page.evaluate(() =>
    document
      .querySelectorAll('[data-reveal]')
      .forEach((el) => el.setAttribute('data-reveal', 'shown')),
  )
  await page.waitForTimeout(400)

  const { count, clashes } = await page.evaluate(PROBE)
  failures += clashes.length
  console.log(`  ${clashes.length ? 'FAIL' : 'pass'}  ${route}  (${count} bands)`)
  for (const clash of clashes) {
    console.log(`        ${clash.background}`)
    console.log(`          above: "${clash.first}"`)
    console.log(`          below: "${clash.second}"`)
  }
}

await browser.close()

console.log()
if (failures) {
  console.error(
    `${failures} pair(s) of adjacent bands share a background.\n` +
      'Alternate the quiet grounds (base, offwhite) with the stated ones\n' +
      '(raised, olive, accent) — see "The ground ladder" in DESIGN.md.',
  )
  process.exit(1)
}
console.log('Every adjacent pair of bands differs.')
