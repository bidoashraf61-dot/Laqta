/**
 * Apply an editorial pass back onto the site.
 *
 * The other half of `export-content.ts`. It reads lines in the same keyed shape
 * the export writes — `- \`key\` :: text` — and applies them to
 * `messages/ar.json` and, for `doc.*` keys, to the Arabic in `content/legal.ts`.
 *
 * It validates before it writes, because the whole point of a keyed return is
 * that a mistake is caught by a machine rather than found on the live page:
 *
 *   - the key exists (a renamed key would silently add dead copy)
 *   - `{placeholders}` come back exactly as they went out — dropping `{count}`
 *     removes the number from a card
 *   - no decorative tatweel, no «..», no licence wording `verify:licence` would reject
 *   - SEO descriptions stay within 160 characters
 *
 * Anything after `⟂` is ignored (the English hint), as is every line that is
 * not a keyed line, so a writer's notes section costs nothing.
 *
 * Dry-run by default; pass `--apply` to write.
 *
 *     npx tsx scripts/import-content.ts docs/gemini/return-01.md [--apply] [--locale en]
 *
 * `--locale en` applies to `messages/en.json` and the English side of the
 * documents (`headingEn` / `bodyEn` / `listEn`) instead.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import * as legal from '../content/legal'
import type { DocumentSection } from '../components/layout/document-page'

type Tree = { [k: string]: string | Tree }

const [file, ...flags] = process.argv.slice(2)
if (!file) {
  console.error('usage: import-content <file> [--apply]')
  process.exit(2)
}
const apply = flags.includes('--apply')
const locale = flags.includes('--locale') ? flags[flags.indexOf('--locale') + 1] : 'ar'
if (locale !== 'ar' && locale !== 'en') {
  console.error('--locale must be ar or en')
  process.exit(2)
}
const messagesFile = `messages/${locale}.json`

const DOCS: Record<string, DocumentSection[]> = {
  terms: legal.TERMS,
  privacy: legal.PRIVACY,
  licences: legal.LICENCES,
  contentPolicy: legal.CONTENT_POLICY,
  about: legal.ABOUT,
  contact: legal.CONTACT,
}

const ar = JSON.parse(readFileSync(messagesFile, 'utf8')) as Tree

function getMessage(key: string): string | undefined {
  let node: string | Tree | undefined = ar
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

function setMessage(key: string, value: string) {
  const parts = key.split('.')
  let node = ar
  for (const part of parts.slice(0, -1)) node = node[part] as Tree
  node[parts[parts.length - 1]] = value
}

/** `doc.<id>.<n>.heading` · `doc.<id>.<n>.body.<j>` · `doc.<id>.<n>.list.<j>` */
function getDoc(key: string): string | undefined {
  const m = key.match(/^doc\.(\w+)\.(\d+)\.(heading|body|list)(?:\.(\d+))?$/)
  if (!m) return undefined
  const section = DOCS[m[1]]?.[Number(m[2]) - 1]
  if (!section) return undefined
  const en = locale === 'en'
  if (m[3] === 'heading') return m[4] ? undefined : en ? section.headingEn : section.heading
  const list =
    m[3] === 'body' ? (en ? section.bodyEn : section.body) : en ? section.listEn : section.list
  return m[4] ? list?.[Number(m[4]) - 1] : undefined
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

// ── Read ──────────────────────────────────────────────────────────────────
const LINE = /^- `([^`]+)` :: (.*)$/
const edits: Array<{ key: string; from: string; to: string }> = []
const problems: string[] = []
const seen = new Set<string>()

for (const raw of readFileSync(file, 'utf8').split('\n')) {
  const m = raw.match(LINE)
  if (!m) continue
  const key = m[1]
  const to = m[2].split('⟂')[0].trim().replace(/\\n/g, '\n')

  if (seen.has(key)) problems.push(`${key}: appears twice`)
  seen.add(key)

  const from = key.startsWith('doc.') ? getDoc(key) : getMessage(key)
  if (from === undefined) {
    problems.push(`${key}: no such key`)
    continue
  }
  if (!to) problems.push(`${key}: empty`)
  if (placeholders(from) !== placeholders(to))
    problems.push(`${key}: placeholders ${placeholders(from) || '∅'} → ${placeholders(to) || '∅'}`)
  // Tatweel between two letters is decoration; after a detached prefix — «بـ»,
  // «الـ{days}» — it is how Arabic writes the prefix, and stays.
  if (/[\u0621-\u064A]ـ+[\u0621-\u064A]/.test(to)) problems.push(`${key}: tatweel`)
  if (/\.\./.test(to)) problems.push(`${key}: «..»`)
  if (/الترخيص القياسي|الترخيص الموسّع|بحد أقصى[^.]{0,40}[\d٠-٩]/u.test(to))
    problems.push(`${key}: licence wording verify:licence rejects`)
  if (key.startsWith('brand.seo.') && to.length > 160)
    problems.push(`${key}: ${to.length} characters, over 160`)

  if (from !== to) edits.push({ key, from, to })
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) — nothing written:\n  ` + problems.join('\n  '))
  process.exit(1)
}

console.log(`${seen.size} line(s) read, ${edits.length} change(s).`)
if (!apply) {
  console.log('Dry run. Pass --apply to write.')
  process.exit(0)
}

// ── Write ─────────────────────────────────────────────────────────────────
let legalSource = readFileSync('content/legal.ts', 'utf8')
const literal = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
/**
 * Every string literal in the source whose VALUE equals `text` — matched by
 * value, not spelling, because the English is written with \u2014 escapes and
 * sometimes in double quotes, and the same text can be spelt several ways.
 */
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g
function spansOf(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  for (const m of legalSource.matchAll(LITERAL)) {
    let value: unknown
    try {
      value = new Function(`return ${m[0]}`)()
    } catch {
      continue
    }
    if (value === text) spans.push([m.index!, m.index! + m[0].length])
  }
  return spans
}

for (const { key, from, to } of edits) {
  if (!key.startsWith('doc.')) {
    setMessage(key, to)
    continue
  }
  // Documents are source, not data: replace the exact Arabic literal, and
  // refuse if it is not there exactly once — a paragraph that appears twice
  // cannot be edited by its text alone.
  const spans = spansOf(from)
  if (spans.length !== 1) {
    console.error(`✗ ${key}: found ${spans.length} times in content/legal.ts — edit it by hand`)
    process.exit(1)
  }
  const [start, end] = spans[0]
  legalSource = legalSource.slice(0, start) + literal(to) + legalSource.slice(end)
}

writeFileSync(messagesFile, JSON.stringify(ar, null, 2) + '\n')
writeFileSync('content/legal.ts', legalSource)
console.log(`✓ applied ${edits.length} change(s).`)
