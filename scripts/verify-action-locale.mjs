#!/usr/bin/env node
/**
 * A server action may not translate with `t()`.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * `t()` reads the locale from an ambient store built on React's `cache()`.
 * `cache()` memoises per RENDER — and a server action does not run inside one.
 * Outside a render every call to the cached factory returns a FRESH holder, so
 * `setLocale()` writes to one object and `currentLocale()` reads another. The
 * store is therefore always at its default, and the default is deliberately
 * Arabic.
 *
 * The result is an Arabic sentence answering an English page while the request
 * header, the middleware and `requestLocale()` are all correct. The PAGE is
 * fine, so no screenshot and no page-level Arabic check can see it: the leak
 * arrives later, in a response to a button.
 *
 * The fix is to take `requestLocale()`'s RETURN value — which is right — and
 * pass it to `translate(locale, key)` explicitly.
 *
 * Static, not a browser gate: this is a property of the source, and every
 * action would otherwise need a click to be covered.
 */
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

/*
 * Two populations, one rule.
 *
 * Server actions, and everything that renders mail. A background sender has no
 * request and therefore no render, so `t()` fails there for exactly the same
 * reason — it just fails later, in a message nobody sees being written.
 */
const files = [
  ...globSync(['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'components/**/*.tsx']).filter((f) => {
    const head = readFileSync(f, 'utf8').slice(0, 200)
    return /^\s*['"]use server['"]/.test(head)
  }),
  ...globSync(['emails/**/*.ts', 'emails/**/*.tsx', 'lib/outbox.ts', 'lib/certificate.ts']),
]

// A `t(` call that is not `translate(`, not `.t(`, and not part of a longer name.
const CALL = /(^|[^A-Za-z0-9_.$])t\(/

const findings = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inBlockComment = false
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false
      return
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true
      return
    }
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
    if (CALL.test(line)) findings.push(`${file}:${i + 1}  ${trimmed}`)
  })
}

console.log(`Checked ${files.length} server-action and mail modules.\n`)
if (findings.length) {
  console.error('Translated with t() outside a render. It will answer in Arabic whatever the reader is on:\n')
  for (const f of findings) console.error('  ' + f)
  console.error('\nUse `const tr = await actionT()` (or translate(locale, key)) instead.')
  process.exit(1)
}
console.log('No server action translates through the render-scoped store.')
