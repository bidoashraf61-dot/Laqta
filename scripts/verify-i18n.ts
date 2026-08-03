/**
 * i18n and formatting check.
 *
 *   npx tsx scripts/verify-i18n.ts
 *
 * Guards the three things that quietly rot as five sessions add copy:
 * locale switching must preserve the path, the two dictionaries must have the
 * same keys, and no Arabic string may be left as its English placeholder.
 */
import ar from '../messages/ar.json'
import en from '../messages/en.json'
import {
  localisePath,
  localeFromPath,
  formatMoney,
  formatDate,
  formatHijri,
  normaliseArabic,
  getTranslator,
  type Locale,
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

console.log('i18n verification\n')

// ── Locale switching keeps you where you were ────────────────────────────────
const paths: Array<[string, Locale, string]> = [
  ['/ar/albums/alula-golden-hour', 'en', '/en/albums/alula-golden-hour'],
  ['/en/footage', 'ar', '/ar/footage'],
  ['/ar', 'en', '/en'],
  ['/albums/x', 'ar', '/ar/albums/x'],
]
for (const [from, locale, expected] of paths) {
  const got = localisePath(from, locale)
  report(`${from} → ${locale}`, got === expected, got)
}
report('unprefixed path falls back to Arabic', localeFromPath('/albums') === 'ar')

// ── Dictionaries agree ───────────────────────────────────────────────────────
const flatAr = flatten(ar)
const flatEn = flatten(en)
const missingEn = Object.keys(flatAr).filter((key) => !(key in flatEn))
const missingAr = Object.keys(flatEn).filter((key) => !(key in flatAr))
report('every Arabic key exists in English', missingEn.length === 0, missingEn.join(', '))
report('every English key exists in Arabic', missingAr.length === 0, missingAr.join(', '))

// Arabic is the source of truth; an Arabic value identical to the English one
// is almost always an untranslated placeholder that shipped by accident.
const ARABIC = /[؀-ۿ]/
const untranslated = Object.keys(flatAr).filter(
  (key) =>
    flatAr[key] === flatEn[key] &&
    !ARABIC.test(flatAr[key]) &&
    // Brand and proper nouns are legitimately the same in both.
    !/^brand\./.test(key),
)
report('no Arabic string left as English', untranslated.length === 0, untranslated.join(', '))

// ── Formatting ───────────────────────────────────────────────────────────────
const now = new Date('2026-08-04T10:00:00Z')
console.log(`\n  money    ar  ${formatMoney(1499, 'ar')}`)
console.log(`  money    en  ${formatMoney(1499, 'en')}`)
console.log(`  money    ar (Arabic-Indic)  ${formatMoney(1499, 'ar', 'SAR', { arabicDigits: true })}`)
console.log(`  date     ar  ${formatDate(now, 'ar')}`)
console.log(`  hijri        ${formatHijri(now)}`)
console.log(`  interpolation  ${getTranslator('ar')('commerce.fromAlbum', { album: 'العلا' })}`)

report(
  'Arabic search folding matches spelling variants',
  normaliseArabic('أَحْمَد') === normaliseArabic('احمد'),
  normaliseArabic('أَحْمَد'),
)
report(
  'alef maqsura folds to yaa (العلى → العلا side)',
  normaliseArabic('العلى') === normaliseArabic('العلي'),
)

console.log(failures === 0 ? '\nAll i18n checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
