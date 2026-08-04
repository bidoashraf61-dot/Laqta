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
import ar from '../messages/ar.json'
import { t, formatMoney, formatDate, formatHijri, normaliseArabic, isArabic } from '../lib/i18n'

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
