import ar from '@/messages/ar.json'

/**
 * Copy and formatting.
 *
 * Laqta ships in Arabic only. There is no locale segment in the URL, no
 * language switcher, and no second dictionary — `laqta.sa/albums`, not
 * `laqta.sa/ar/albums`.
 *
 * This is the *interface* language. The catalogue itself stays bilingual:
 * `Album.titleEn`, `Clip.titleEn` and the taxonomy's English synonyms are all
 * still populated, because they carry the transliterations that let an Arabic
 * query match English-tagged footage ("AlUla" ↔ "العلا"), and because creators
 * are worldwide. Dropping English from the UI is not dropping it from the data.
 */

export const locale = 'ar' as const
export const direction = 'rtl' as const
/** BCP-47 tag used for all Intl formatting. */
export const bcp47 = 'ar-SA'

type Messages = typeof ar

/**
 * Dot-path lookup with `{placeholder}` interpolation. A missing key returns
 * the key itself, so a gap is loud on screen rather than an invisible blank.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, ar as Messages)

  if (typeof value !== 'string') return key
  if (!vars) return value

  return value.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  )
}

// ── Formatting ──────────────────────────────────────────────────────────────

/**
 * Money.
 *
 * Western digits by default: Saudi buyers overwhelmingly read prices in them,
 * and mixing Arabic-Indic numerals with an LTR currency code hurts
 * scannability. `arabicDigits` is there when editorial copy wants ١٬٤٩٩.
 */
export function formatMoney(
  amount: number | string,
  currency = 'SAR',
  options: { arabicDigits?: boolean } = {},
) {
  const value = typeof amount === 'string' ? Number(amount) : amount
  const numbering = options.arabicDigits ? '-u-nu-arab' : '-u-nu-latn'
  return new Intl.NumberFormat(`${bcp47}${numbering}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(`${bcp47}-u-nu-latn`).format(value)
}

export function formatPercent(fraction: number, digits = 1) {
  return new Intl.NumberFormat(`${bcp47}-u-nu-latn`, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction)
}

export function formatDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(`${bcp47}-u-nu-latn-ca-gregory`, {
    dateStyle: 'medium',
  }).format(date)
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(`${bcp47}-u-nu-latn-ca-gregory`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Hijri, offered alongside Gregorian on buyer-facing surfaces. */
export function formatHijri(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    dateStyle: 'medium',
  }).format(date)
}

/**
 * Search-side Arabic folding: strip diacritics and tatweel, then fold the
 * hamza family, teh marbuta and alef maqsura, so احمد matches أحمد and
 * جده matches جدة. The search index applies exactly this on both sides.
 */
export function normaliseArabic(input: string) {
  return input
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim()
    .toLowerCase()
}

/** True when a string contains Arabic script — picks the direction island. */
export function isArabic(value: string) {
  return /[؀-ۿ]/.test(value)
}
