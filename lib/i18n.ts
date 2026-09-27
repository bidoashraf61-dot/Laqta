import ar from '@/messages/ar.json'
import en from '@/messages/en.json'
import { cache } from 'react'
import { BCP47, currentLocale, DIRECTION, type Locale } from '@/lib/locale'

/**
 * Copy and formatting.
 *
 * Laqta ships in Arabic and English. Arabic is the default and owns the bare
 * path — `laqta.sa/albums` — while English is served under `/en/albums`, which
 * the middleware rewrites onto the same route tree. Every string here follows
 * whichever locale the current request resolved to.
 *
 * This is the *interface* language, and it is separate from the catalogue's own
 * bilingualism: `Album.titleEn`, `Clip.titleEn` and the taxonomy's English
 * synonyms carry the transliterations that let an Arabic query match
 * English-tagged footage ("AlUla" ↔ "العلا"). Those are data, and they are
 * populated in both languages regardless of which one the interface is in.
 */

const DICTIONARIES = { ar, en } as const

/**
 * Arabic is the fallback for BOTH dictionaries.
 *
 * A key missing from `en.json` renders its Arabic rather than the raw dot-path.
 * A half-translated screen is a shipping reality; a screen of `landing.faq3Q`
 * is a bug report. The gap is still visible — it is Arabic on an English page —
 * but the page works.
 */
function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}

/**
 * @deprecated Constants from the Arabic-only era. They describe the DEFAULT,
 * not the request — reading them on an English page silently yields Arabic.
 * Use `activeDirection()` / `activeBcp47()`.
 */
export const locale = 'ar' as const
export const direction = 'rtl' as const
export const bcp47 = 'ar-SA'

export function activeDirection() {
  return DIRECTION[currentLocale()]
}
export function activeBcp47() {
  return BCP47[currentLocale()]
}

type Messages = typeof ar

/**
 * Dot-path lookup with `{placeholder}` interpolation. A missing key returns
 * the key itself, so a gap is loud on screen rather than an invisible blank.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(currentLocale(), key, vars)
}

/**
 * The lookup itself, with the locale passed in.
 *
 * `t()` reads the locale from the ambient store, which only exists in the RSC
 * render. Client components have their own source for it (see lib/i18n-client)
 * and call this directly, so the dictionary logic lives in one place instead of
 * being written twice and drifting.
 */
export function translate(
  active: Locale,
  key: string,
  vars?: Record<string, string | number>,
  overrides?: CopyOverrideMap | null,
): string {
  let value: unknown = overrideFor(active, key, overrides)
  if (typeof value !== 'string') value = lookup(DICTIONARIES[active], key)
  if (typeof value !== 'string' && active !== 'ar') value = lookup(ar as Messages, key)

  if (typeof value !== 'string') return key
  if (!vars) return value

  return value.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  )
}

// ── Edited copy (DEV-64b) ───────────────────────────────────────────────────

/**
 * `{ "<locale>:<key>": value }` — strings the owner edited from
 * `/admin/content/copy`, layered over the JSON. The JSON is never modified and
 * is always the fallback: a key with no entry here reads the dictionary.
 */
export type CopyOverrideMap = Record<string, string>

const IS_SERVER = typeof window === 'undefined'

/**
 * The PUBLISHED edits, process-wide on the server. Global is correct here,
 * unlike the locale: every reader sees the same published copy, so two
 * concurrent requests cannot disagree about it. Filled and refreshed by
 * `lib/copy-overrides.ts#refreshCopyOverrides` (called from `requestLocale()`
 * and before mail renders). Never set in the browser — client components get
 * their map through context (`lib/i18n-client`), passed as `overrides`.
 */
let published: CopyOverrideMap = {}

export function setPublishedCopy(map: CopyOverrideMap) {
  published = map
}

/**
 * Unpublished drafts for ONE render — the owner previewing edits on the real
 * page. Per-render (React `cache()`), so a preview can never leak into another
 * visitor's page; outside a render (actions, mail) there is no draft.
 */
const draftHolder = cache((): { current: CopyOverrideMap | null } => ({ current: null }))

export function setDraftCopy(map: CopyOverrideMap | null) {
  if (IS_SERVER) draftHolder().current = map
}

/** True while this render shows unpublished copy (the owner's preview). */
export function isCopyPreview(): boolean {
  return IS_SERVER && draftHolder().current !== null
}

/** Published + this render's drafts, for one locale — what client components need. */
export function activeCopy(locale: Locale): CopyOverrideMap {
  const merged: CopyOverrideMap = {}
  const prefix = `${locale}:`
  for (const source of [published, IS_SERVER ? draftHolder().current : null]) {
    if (!source) continue
    for (const [k, v] of Object.entries(source)) if (k.startsWith(prefix)) merged[k] = v
  }
  return merged
}

function overrideFor(active: Locale, key: string, explicit?: CopyOverrideMap | null) {
  const id = `${active}:${key}`
  if (explicit) return explicit[id]
  if (!IS_SERVER) return undefined
  return draftHolder().current?.[id] ?? published[id]
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
  currency = 'USD',
  options: { arabicDigits?: boolean } = {},
) {
  return formatMoneyIn(activeBcp47(), amount, currency, options)
}

/**
 * The same, with the locale passed in rather than read from the store.
 *
 * A CLIENT component must use this. `activeBcp47()` reads the RSC-scoped
 * store, which does not exist in the browser render — a client component
 * calling `formatMoney` silently formats every price as Arabic, on every
 * page, in both languages. The infinite results grid renders its cards on the
 * client, so this is not hypothetical.
 */
export function formatMoneyIn(
  bcp47: string,
  amount: number | string,
  currency = 'USD',
  options: { arabicDigits?: boolean } = {},
) {
  const value = typeof amount === 'string' ? Number(amount) : amount
  const numbering = options.arabicDigits ? '-u-nu-arab' : '-u-nu-latn'
  return (
    new Intl.NumberFormat(`${bcp47}${numbering}`, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
      .format(Number.isFinite(value) ? value : 0)
      // Same bidi hygiene as formatDate: `ar-SA` wraps the currency run in
      // directional marks. Money is always shown in an isolated `.numeric` span,
      // so the marks are redundant at best and a reorder risk at worst — drop them.
      .replace(BIDI_MARKS, '')
  )
}

/**
 * Counted nouns — «لقطة واحدة», «لقطتان», «٦ لقطات», «٢٢ لقطة», "22 clips".
 *
 * Arabic number agreement has five live forms, and `Intl.PluralRules('ar')`
 * names them exactly: `zero` (0), `one` (1), `two` (2), `few` (3–10, and
 * 103–110 …), `many` (11–99 — the singular accusative tamyīz: «١٥ ألبوماً»)
 * and `other` (100, 1000 … — the singular genitive: «١٠٠ ألبوم»). English
 * has `one` and `other`. Each noun keeps all six forms in BOTH dictionaries
 * under `count.<noun>.<form>` — English repeats its plural — so the copy
 * editor never shows an Arabic default in an English field.
 *
 * Never write `{n} {t('commerce.clip')}`: that is how "22 clip" and
 * «٣ صانع محتوى» shipped. `verify:i18n` refuses the pattern.
 *
 * `countLabel` is the same noun WITHOUT the number, for a stat tile that sets
 * the figure large on its own line (`count.<noun>Label.<form>`).
 */
export const COUNT_NOUNS = [
  'clip',
  'album',
  'creator',
  'result',
  'rating',
  'preview',
  'zip',
  'search',
] as const
export type CountNoun = (typeof COUNT_NOUNS)[number]
export const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

const PLURAL_RULES: Record<Locale, Intl.PluralRules> = {
  ar: new Intl.PluralRules('ar'),
  en: new Intl.PluralRules('en'),
}

export function pluralForm(active: Locale, n: number) {
  return PLURAL_RULES[active].select(n) as (typeof PLURAL_FORMS)[number]
}

/** The count, with the locale passed in — client components and mail use this. */
export function countIn(
  active: Locale,
  noun: CountNoun,
  n: number,
  overrides?: CopyOverrideMap | null,
): string {
  const count = formatNumberIn(BCP47[active], n)
  return translate(active, `count.${noun}.${pluralForm(active, n)}`, { count }, overrides)
}

/** The noun alone, agreeing with `n` — for a tile whose figure is set apart. */
export function countLabelIn(
  active: Locale,
  noun: CountNoun,
  n: number,
  overrides?: CopyOverrideMap | null,
): string {
  return translate(active, `count.${noun}Label.${pluralForm(active, n)}`, undefined, overrides)
}

/** `countIn` for the request's locale (server components). */
export function countOf(noun: CountNoun, n: number): string {
  return countIn(currentLocale(), noun, n)
}

export function countLabel(noun: CountNoun, n: number): string {
  return countLabelIn(currentLocale(), noun, n)
}

export function formatNumberIn(bcp47: string, value: number) {
  return new Intl.NumberFormat(`${bcp47}-u-nu-latn`).format(value)
}

export function formatNumber(value: number) {
  return formatNumberIn(activeBcp47(), value)
}

export function formatPercent(fraction: number, digits = 1) {
  return new Intl.NumberFormat(`${activeBcp47()}-u-nu-latn`, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction)
}

/**
 * Intl formats an `ar-SA` Gregorian date as `01‏/08‏/2026` — Latin digits, but
 * with a U+200F RIGHT-TO-LEFT MARK wedged between each segment. Every date in
 * the UI is rendered inside a `.numeric` span (forced LTR, isolated), and in
 * that context those marks flip the slashes and reorder the parts to
 * `012026/08/`. It survives in a table cell and breaks in a paragraph — the
 * exact kind of bidi landmine this codebase isolates against. Since the output
 * is always shown LTR, the directional marks are pure harm: strip them.
 */
const BIDI_MARKS = /[‎‏؜]/g

export function formatDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(`${activeBcp47()}-u-nu-latn-ca-gregory`, {
    dateStyle: 'medium',
  })
    .format(date)
    .replace(BIDI_MARKS, '')
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(`${activeBcp47()}-u-nu-latn-ca-gregory`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
    .format(date)
    .replace(BIDI_MARKS, '')
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
