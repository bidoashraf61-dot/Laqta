#!/usr/bin/env node
/**
 * Every fill/ink pair, in every ground scope, measured against WCAG AA.
 *
 * ── Why this exists alongside verify:contrast ───────────────────────────────
 * `verify:contrast` drives real Chrome and measures what is actually painted.
 * It is the stronger check and it stays. But it can only measure states it can
 * reach: it never hovers anything, so a hover colour is invisible to it — and
 * a hover colour is exactly what broke.
 *
 * `.on-olive` re-pitched `--gold` to a light gold with dark ink, and left
 * `--gold-400` — the hover fill — inherited from `:root`, where gold is dark
 * ink on paper. The CTA read 6.91:1 at rest and 1.37:1 under the pointer. No
 * screenshot review catches that, because nothing is hovering during a
 * screenshot review.
 *
 * This reads the tokens straight out of globals.css and checks every pair
 * arithmetically, including the states a browser check cannot visit.
 *
 * It is deliberately dumb about usage: it asserts that a fill and its declared
 * `-foreground` partner are legible together, wherever they are used. If a pair
 * is genuinely never combined, the honest fix is to stop declaring them as a
 * pair — not to special-case them here.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'styles/globals.css'), 'utf8')

/** AA for body text. Large text is 3:1, but a button label is not large. */
const MIN = 4.5

/** Pull `--name: h s% l%` declarations out of one selector's block. */
function block(selector) {
  const at = css.indexOf(selector + ' {')
  if (at === -1) throw new Error(`no ${selector} block in globals.css`)
  let depth = 0
  let i = css.indexOf('{', at)
  const from = i
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) break
  }
  const tokens = {}
  for (const m of css.slice(from, i).matchAll(/--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])]
  }
  return tokens
}

function hslToRgb([h, s, l]) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}
const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function luminance(hsl) {
  const [r, g, b] = hslToRgb(hsl).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const base = block(':root')
const scopes = {
  'paper (:root)': base,
  'film (.dark)': { ...base, ...block('.dark') },
  'olive band (.on-olive)': { ...base, ...block('.on-olive') },
  'dusty band (.on-dusty)': { ...base, ...block('.on-dusty') },
}

/**
 * `gold-400` is listed as a fill against `gold-foreground` because that is what
 * `Button variant="gold"` paints on hover: the fill changes, the ink does not.
 */
const PAIRS = [
  ['gold — rest', 'gold', 'gold-foreground'],
  ['gold — hover', 'gold-400', 'gold-foreground'],
  ['primary — rest', 'primary', 'primary-foreground'],
  ['primary — hover', 'primary-hover', 'primary-foreground'],
  ['secondary — rest', 'secondary', 'secondary-foreground'],
  ['secondary — hover', 'secondary-hover', 'secondary-foreground'],
  ['accent (ghost hover)', 'accent', 'accent-foreground'],
  ['destructive — rest', 'destructive', 'destructive-foreground'],
  ['destructive — hover', 'destructive-hover', 'destructive-foreground'],
  ['muted', 'muted', 'muted-foreground'],
  ['card', 'card', 'card-foreground'],
  ['popover', 'popover', 'popover-foreground'],
  ['page', 'background', 'foreground'],
  ['page — muted text', 'background', 'muted-foreground'],
]

let failures = 0
for (const [scope, tokens] of Object.entries(scopes)) {
  console.log(`\n  ${scope}`)
  for (const [label, fill, ink] of PAIRS) {
    if (!tokens[fill] || !tokens[ink]) {
      console.log(`    ????  ${label.padEnd(22)} token missing (${fill} / ${ink})`)
      failures++
      continue
    }
    const ratio = contrast(tokens[fill], tokens[ink])
    const ok = ratio >= MIN
    if (!ok) failures++
    console.log(
      `    ${ok ? 'pass' : 'FAIL'}  ${label.padEnd(22)} ${ratio.toFixed(2)}:1` +
        (ok ? '' : `   fill ${tokens[fill].join(' ')} / ink ${tokens[ink].join(' ')}`),
    )
  }
}

console.log()
if (failures) {
  console.error(
    `${failures} pair(s) below ${MIN}:1.\n` +
      'A fill and its ink are one decision. If a scope re-pitches a fill, it\n' +
      'must re-pitch that fill\'s hover, active and disabled steps too — see\n' +
      '"Grounds and inks travel together" in DESIGN.md.',
  )
  process.exit(1)
}
console.log(`Every fill/ink pair clears ${MIN}:1 in all ${Object.keys(scopes).length} scopes.`)
