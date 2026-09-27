/**
 * Copy and formatting check.
 *
 *   npx tsx scripts/verify-i18n.ts
 *
 * The site is Arabic-only, so there is no dictionary parity to check any more.
 * What can still rot as five sessions add copy is: an English placeholder left
 * in the Arabic dictionary, a key referenced but never added, and the Arabic
 * search folding that makes احمد match أحمد.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ar from '../messages/ar.json'
import en from '../messages/en.json'
import {
  t,
  formatMoney,
  formatDate,
  formatHijri,
  normaliseArabic,
  isArabic,
  countIn,
  countLabelIn,
  COUNT_NOUNS,
  PLURAL_FORMS,
} from '../lib/i18n'

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

function flatten(source: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  if (!source || typeof source !== 'object') return out
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') Object.assign(out, flatten(value, path))
    else out[path] = String(value)
  }
  return out
}

console.log('Copy and formatting\n')

const flat = flatten(ar)
console.log(`  ${Object.keys(flat).length} keys in messages/ar.json`)

/**
 * Latin values that are not proper nouns are almost always an untranslated
 * placeholder that shipped by accident.
 */
// Product names that are Latin in Arabic copy too — Apple Pay is written
// "Apple Pay" on every Saudi checkout, not transliterated.
// Payment and payout rails are trademarks, not untranslated copy — "Payoneer"
// has no Arabic form and inventing one would make the label unrecognisable on
// a bank statement. Same exemption the checkout already carries for Apple Pay;
// verify-arabic's ALLOWED set sanctions the same words at render time.
const PROPER_NOUN_KEYS = /^(brand\.|palette\.|checkout\.methodApplePay|dash\.method(Payoneer|Wise))/
const untranslated = Object.entries(flat).filter(
  ([key, value]) => !isArabic(value) && !PROPER_NOUN_KEYS.test(key) && /[A-Za-z]{3}/.test(value),
)
report(
  'no English left in the Arabic dictionary',
  untranslated.length === 0,
  untranslated.map(([key]) => key).join(', '),
)

report('a missing key returns the key, not a blank', t('does.not.exist') === 'does.not.exist')
report('interpolation fills placeholders', t('commerce.fromAlbum', { album: 'العلا' }).includes('العلا'))
report(
  'an unfilled placeholder stays visible',
  t('commerce.fromAlbum').includes('{album}'),
)

// ── Counted nouns (DEV-22) ───────────────────────────────────────────────────
// Arabic number agreement: 1 singular, 2 dual, 3–10 plural, 11–99 singular
// accusative, 100+ singular genitive. English: one / other. Every count on the
// site goes through countOf / useCount; a number glued to a fixed noun is how
// "22 clip" and «٣ صانع محتوى» shipped.
console.log('\n  Counted nouns')
const flatEn = flatten(en)
const LABELLED = new Set(['clip', 'album', 'creator'])
const missingForms: string[] = []
for (const noun of COUNT_NOUNS) {
  for (const form of PLURAL_FORMS) {
    for (const [name, dict] of [['ar', flat], ['en', flatEn]] as const) {
      if (typeof dict[`count.${noun}.${form}`] !== 'string') missingForms.push(`${name}:count.${noun}.${form}`)
      if (LABELLED.has(noun) && typeof dict[`count.${noun}Label.${form}`] !== 'string')
        missingForms.push(`${name}:count.${noun}Label.${form}`)
    }
  }
}
report('every counted noun has all six plural forms in both languages', missingForms.length === 0, missingForms.join(', '))

const expectations: Array<[string, 'ar' | 'en', Parameters<typeof countIn>[1], number, string]> = [
  ['1 clip, singular', 'ar', 'clip', 1, 'لقطة واحدة'],
  ['2 clips, dual', 'ar', 'clip', 2, 'لقطتان'],
  ['3 clips, plural', 'ar', 'clip', 3, '3 لقطات'],
  ['10 clips, plural', 'ar', 'clip', 10, '10 لقطات'],
  ['11 clips, singular', 'ar', 'clip', 11, '11 لقطة'],
  ['22 clips, singular', 'ar', 'clip', 22, '22 لقطة'],
  ['100 clips, singular', 'ar', 'clip', 100, '100 لقطة'],
  ['103 clips, plural', 'ar', 'clip', 103, '103 لقطات'],
  ['3 creators, plural', 'ar', 'creator', 3, '3 صنّاع محتوى'],
  ['1 creator', 'ar', 'creator', 1, 'صانع محتوى واحد'],
  ['15 albums, accusative', 'ar', 'album', 15, '15 ألبوماً'],
  ['100 albums, genitive', 'ar', 'album', 100, '100 ألبوم'],
  ['EN 1 clip', 'en', 'clip', 1, '1 clip'],
  ['EN 22 clips', 'en', 'clip', 22, '22 clips'],
  ['EN 0 albums', 'en', 'album', 0, '0 albums'],
  ['EN 1 creator', 'en', 'creator', 1, '1 creator'],
  ['EN 1,200 results', 'en', 'result', 1200, '1,200 results'],
]
for (const [name, locale, noun, n, want] of expectations) {
  const got = countIn(locale, noun, n, {})
  report(`count: ${name}`, got === want, got)
}
report('label: 5 creators → صنّاع محتوى', countLabelIn('ar', 'creator', 5, {}) === 'صنّاع محتوى')
report('label: 22 clips → لقطة', countLabelIn('ar', 'clip', 22, {}) === 'لقطة')
report('label: EN 1 album → album', countLabelIn('en', 'album', 1, {}) === 'album')

// A placeholder number glued to a fixed noun in the copy itself.
const GLUED =
  /\{(count|n|limit|total|ready)\}\s+(clips?|albums?|creators?|results?|ratings?|reviews?|previews?|strings?|rows?|items?|لقط|ألبوم|صانع|صنّاع|نتيج|تقييم|معاين|صف|نص|بند|تحويل|طلب|ملف)/
const glued = [
  ...Object.entries(flat).map(([k, v]) => ['ar', k, v] as const),
  ...Object.entries(flatEn).map(([k, v]) => ['en', k, v] as const),
].filter(([, key, value]) => !key.startsWith('count.') && GLUED.test(value))
report(
  'no copy glues a count to a fixed noun (use count.* instead)',
  glued.length === 0,
  glued.map(([l, k]) => `${l}:${k}`).join(', '),
)

// …and in the components: `{n} {t('commerce.clip')}`, across a <span> or {' '}.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.tsx') ? [path] : []
  })
}
const GLUED_JSX =
  /\{(?!t\(|count(Of|Label)?\()[^{}]*?((?<![a-z])(count|length|total|albums|clips|creators|views|searches|ratings)|Count|Total)[^{}]*\}(<\/span>)?(\s|\{' '\})*\{t\('[^']+'\)\}/
const gluedJsx = ['app', 'components'].flatMap(walk).filter((file) => GLUED_JSX.test(readFileSync(file, 'utf8')))
report('no component renders a number next to a fixed noun', gluedJsx.length === 0, gluedJsx.join(', '))

// ── Formatting ───────────────────────────────────────────────────────────────
const now = new Date('2026-08-04T10:00:00Z')
console.log(`\n  money            ${formatMoney(1499)}`)
console.log(`  money (Arabic-Indic)  ${formatMoney(1499, 'SAR', { arabicDigits: true })}`)
console.log(`  date             ${formatDate(now)}`)
console.log(`  hijri            ${formatHijri(now)}`)

// ── Arabic search folding ────────────────────────────────────────────────────
report(
  'diacritics and hamza fold together',
  normaliseArabic('أَحْمَد') === normaliseArabic('احمد'),
  normaliseArabic('أَحْمَد'),
)
report('teh marbuta folds to heh (جدة ≈ جده)', normaliseArabic('جدة') === normaliseArabic('جده'))
report('alef maqsura folds to yaa', normaliseArabic('العلى') === normaliseArabic('العلي'))
report('tatweel is stripped', normaliseArabic('محـــمد') === normaliseArabic('محمد'))

console.log(failures === 0 ? '\nAll copy checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
