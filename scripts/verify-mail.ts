#!/usr/bin/env node
/**
 * The mail rail.
 *
 * Mail is the one surface with no page to look at. A broken template does not
 * throw a 500 anyone sees — it produces a message that is wrong, or Arabic for
 * an English reader, in an inbox nobody on the team owns. So the checks that
 * would otherwise be "open it and look" have to be a gate.
 *
 * Static and in-process: templates are pure functions of (locale, payload), so
 * every one can be rendered without a browser, a server or a database. That is
 * a property worth keeping — if a template ever needs a query, this gate is
 * what will notice.
 */
import { readFileSync } from 'node:fs'
import { TEMPLATES, renderTemplate } from '../emails/registry'
import type { Locale } from '../lib/locale'
const ar = JSON.parse(readFileSync('messages/ar.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'))

let failures = 0
const fail = (message: string) => {
  console.error(`  FAIL  ${message}`)
  failures++
}
const pass = (message: string) => console.log(`  pass  ${message}`)

/**
 * Every value a template could ask for, so nothing renders as an empty gap.
 *
 * Latin values on purpose. The point of the English check below is that the
 * TEMPLATE's own words are English — but an album's Arabic title legitimately
 * appears inside an English message, so real data would make the check
 * meaningless. Payload values are deliberately not the thing under test.
 */
const PAYLOAD = {
  name: 'Athar Agency',
  orderNumber: 'LQ-2026-1006',
  albums: '• AlUla Aerials',
  album: 'AlUla Aerials',
  creator: 'Yousef Shami',
  price: '399 US$',
  notes: 'Please regrade shot 4.',
  libraryUrl: 'https://laqta.sa/account/library',
  albumUrl: 'https://laqta.sa/albums/x/y',
  reviewUrl: 'https://laqta.sa/admin/review',
}

console.log('\nEvery template renders, in both languages')

const ARABIC = /[؀-ۿ]/
const LATIN_WORD = /\b[A-Za-z]{4,}\b/

for (const template of TEMPLATES) {
  for (const locale of ['ar', 'en'] as Locale[]) {
    let rendered
    try {
      rendered = renderTemplate(template, locale, PAYLOAD)
    } catch (error) {
      fail(`${template} [${locale}] threw: ${(error as Error).message}`)
      continue
    }

    if (!rendered?.subject?.trim()) fail(`${template} [${locale}] has an empty subject`)
    if (!rendered?.body?.trim()) fail(`${template} [${locale}] has an empty body`)

    const text = `${rendered.subject}\n${rendered.body}`

    // An unresolved placeholder is the classic template bug: it ships looking
    // like a typo rather than failing.
    const leftover = text.match(/\{[a-zA-Z]+\}/g)
    if (leftover) fail(`${template} [${locale}] left ${leftover.join(', ')} unresolved`)

    // A missing key falls back to the key path, which reads as gibberish.
    if (/\b(email|brand|dash)\.[a-zA-Z]+\b/.test(text)) {
      fail(`${template} [${locale}] rendered a dot-path — a key is missing`)
    }

    if (locale === 'ar' && !ARABIC.test(text)) {
      fail(`${template} [ar] contains no Arabic`)
    }
    if (locale === 'en') {
      // URLs and the brand's Latin name are legitimate; prose is not.
      const prose = text
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[•—\-]/g, '')
      if (ARABIC.test(prose)) fail(`${template} [en] leaked Arabic into an English message`)
      if (!LATIN_WORD.test(prose)) fail(`${template} [en] contains no English`)
    }
  }
  pass(template)
}

console.log('\nCopy lives in messages/*.json, not in the template')

const source = readFileSync('emails/registry.ts', 'utf8')
// A quoted Arabic string in the registry means a sentence was written inline,
// which puts it beyond verify:arabic and every editorial pass.
if (/['"`][^'"`]*[؀-ۿ]/.test(source)) {
  fail('emails/registry.ts contains an inline Arabic string')
} else {
  pass('no sentence is hard-coded in a template')
}

console.log('\nBoth dictionaries carry the same email keys')

const arKeys = Object.keys(ar.email ?? {}).sort()
const enKeys = Object.keys(en.email ?? {}).sort()
if (!arKeys.length) fail('messages/ar.json has no email section')
const missingEn = arKeys.filter((key) => !enKeys.includes(key))
const missingAr = enKeys.filter((key) => !arKeys.includes(key))
if (missingEn.length) fail(`missing from en.json: ${missingEn.join(', ')}`)
if (missingAr.length) fail(`missing from ar.json: ${missingAr.join(', ')}`)
if (!missingEn.length && !missingAr.length) pass(`${arKeys.length} keys, both languages`)

console.log('\nEvery template a caller enqueues actually exists')

const callers = readFileSync('lib/orders.ts', 'utf8') +
  readFileSync('lib/admin.ts', 'utf8') +
  readFileSync('lib/studio.ts', 'utf8')
/*
 * Only `template:` assignments. An earlier version matched any dotted string
 * and flagged `action: 'order.refund'` — an audit action, not a message. A
 * gate that cries wolf gets switched off.
 */
let named = 0
for (const match of callers.matchAll(/template:\s*([^,\n]+)/g)) {
  for (const quoted of match[1].matchAll(/'([a-z]+\.[a-z]+)'/g)) {
    named++
    if (!(TEMPLATES as readonly string[]).includes(quoted[1])) {
      fail(`a caller enqueues unknown template '${quoted[1]}'`)
    }
  }
}
if (!named) fail('no caller enqueues anything — the rail is not wired')
else pass(`${named} enqueue site(s), all naming a real template`)

if (failures) {
  console.error(`\n${failures} mail check(s) failed.\n`)
  process.exit(1)
}
console.log('\nEvery message renders in both languages, with nothing left unresolved.\n')
