import ar from '@/messages/ar.json'
import en from '@/messages/en.json'

export const locales = ['ar', 'en'] as const
export type Locale = (typeof locales)[number]

/** Arabic is the default and the source of truth for copy. */
export const defaultLocale: Locale = 'ar'

export const localeDirection: Record<Locale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
}

export const localeLabel: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

type Messages = typeof ar
const dictionaries: Record<Locale, Messages> = { ar, en: en as Messages }

/**
 * Dot-path lookup with `{placeholder}` interpolation. Falls back to Arabic,
 * then to the key itself so a missing string is visible rather than blank.
 */
export function getTranslator(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[defaultLocale]

  return function t(key: string, vars?: Record<string, string | number>): string {
    const lookup = (source: unknown) =>
      key.split('.').reduce<unknown>((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
          return (acc as Record<string, unknown>)[part]
        }
        return undefined
      }, source)

    const value = lookup(dict) ?? lookup(dictionaries[defaultLocale])
    if (typeof value !== 'string') return key

    if (!vars) return value
    return value.replace(/\{(\w+)\}/g, (_match, name: string) =>
      name in vars ? String(vars[name]) : `{${name}}`,
    )
  }
}

export type Translator = ReturnType<typeof getTranslator>

/** Swap the locale segment while preserving the rest of the path and query. */
export function localisePath(pathname: string, locale: Locale) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length && isLocale(segments[0])) {
    segments[0] = locale
  } else {
    segments.unshift(locale)
  }
  return `/${segments.join('/')}`
}

export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0]
  return first && isLocale(first) ? first : defaultLocale
}

// ── Formatting ──────────────────────────────────────────────────────────────

const bcp47: Record<Locale, string> = { ar: 'ar-SA', en: 'en-GB' }

/**
 * Money. Arabic-Indic digits are *optional* and off by default — Saudi buyers
 * overwhelmingly read Western digits for prices, and mixing them with an LTR
 * currency code hurts scannability.
 */
export function formatMoney(
  amount: number | string,
  locale: Locale = defaultLocale,
  currency = 'SAR',
  options: { arabicDigits?: boolean } = {},
) {
  const value = typeof amount === 'string' ? Number(amount) : amount
  const numberingSystem = options.arabicDigits && locale === 'ar' ? '-u-nu-arab' : '-u-nu-latn'
  return new Intl.NumberFormat(`${bcp47[locale]}${numberingSystem}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value: number, locale: Locale = defaultLocale) {
  return new Intl.NumberFormat(`${bcp47[locale]}-u-nu-latn`).format(value)
}

export function formatPercent(fraction: number, locale: Locale = defaultLocale, digits = 1) {
  return new Intl.NumberFormat(`${bcp47[locale]}-u-nu-latn`, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction)
}

export function formatDate(value: Date | string, locale: Locale = defaultLocale) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(`${bcp47[locale]}-u-nu-latn-ca-gregory`, {
    dateStyle: 'medium',
  }).format(date)
}

export function formatDateTime(value: Date | string, locale: Locale = defaultLocale) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(`${bcp47[locale]}-u-nu-latn-ca-gregory`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Hijri rendering, offered alongside Gregorian on buyer-facing surfaces. */
export function formatHijri(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    dateStyle: 'medium',
  }).format(date)
}

/**
 * Search-side Arabic normalisation: strip diacritics/tatweel and fold
 * hamza/alef, teh marbuta and alef maqsura so احمد matches أحمد.
 * Mirrors what the Meilisearch index build applies.
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
