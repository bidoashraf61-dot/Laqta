import ar from '@/messages/ar.json'
import en from '@/messages/en.json'
import { BANNED_CLAIMS, MAIL_BANS, SITE_BANS } from '@/lib/copy-claims'
import type { Locale } from '@/lib/locale'

/**
 * Which strings the owner may edit from `/admin/content/copy`, and the rules
 * an edit must meet (DEV-64b). Pure — no database — so the editor runs the
 * same checks in the browser as the server runs at publish.
 *
 * DEV-64b covers the marketing surfaces: the landing page (FAQ included),
 * `/sell`, and the transactional emails. Every other string (DEV-64c) is still
 * code-only.
 */

export const COPY_GROUPS = {
  landing: { prefix: 'landing.', titleKey: 'dash.copy.group.landing', path: '/' },
  sell: { prefix: 'sell.', titleKey: 'dash.copy.group.sell', path: '/sell' },
  email: { prefix: 'email.', titleKey: 'dash.copy.group.email', path: null },
} as const

export type CopyGroup = keyof typeof COPY_GROUPS
export const COPY_GROUP_KEYS = Object.keys(COPY_GROUPS) as CopyGroup[]

export function isCopyGroup(value: string): value is CopyGroup {
  return value in COPY_GROUPS
}

type Tree = { [k: string]: string | Tree }
const DICTIONARIES: Record<Locale, Tree> = { ar: ar as Tree, en: en as Tree }

function flatten(tree: Tree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [[prefix + k, v] as [string, string]] : flatten(v, `${prefix}${k}.`),
  )
}

const FLAT: Record<Locale, Map<string, string>> = {
  ar: new Map(flatten(DICTIONARIES.ar)),
  en: new Map(flatten(DICTIONARIES.en)),
}

/** Every editable key of a group, in the order the JSON lists them (page order). */
export function groupKeys(group: CopyGroup): string[] {
  const prefix = COPY_GROUPS[group].prefix
  return [...FLAT.ar.keys()].filter((key) => key.startsWith(prefix))
}

export function groupOf(key: string): CopyGroup | null {
  return COPY_GROUP_KEYS.find((group) => key.startsWith(COPY_GROUPS[group].prefix)) ?? null
}

export function isEditableKey(key: string) {
  return groupOf(key) !== null && FLAT.ar.has(key)
}

/** The value in messages/<locale>.json — English falls back to Arabic, as `translate` does. */
export function defaultCopy(locale: Locale, key: string): string {
  return FLAT[locale].get(key) ?? FLAT.ar.get(key) ?? ''
}

const PLACEHOLDER = /\{(\w+)\}/g
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))].sort()
}

/**
 * How long an edit may be. A short string is a label, a button or a headline
 * cut sized for its box, so it gets a tight cap; a paragraph gets room.
 */
export function lengthCap(locale: Locale, key: string): number {
  const base = defaultCopy(locale, key).length
  return base <= 40 ? Math.max(24, Math.ceil(base * 1.6)) : Math.ceil(base * 2) + 40
}

const ARABIC_LETTERS = /[؀-ۿݐ-ݿࢠ-ࣿ]/g
const LATIN_LETTERS = /[A-Za-z]/g
const MARKUP = /<\s*\/?\s*[a-z!][^>]*>/i
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

export type CopyError = { key: string; vars?: Record<string, string | number> }

/**
 * The first rule `value` breaks, or null. An empty value is not checked here —
 * empty means "back to the original", which the caller handles.
 */
export function validateCopy(locale: Locale, key: string, value: string): CopyError | null {
  if (!isEditableKey(key)) return { key: 'dash.copy.error.unknownKey' }
  const text = value.trim()
  const original = defaultCopy(locale, key)

  const want = placeholders(original)
  const have = placeholders(text)
  const missing = want.filter((name) => !have.includes(name))
  const extra = have.filter((name) => !want.includes(name))
  if (missing.length) return { key: 'dash.copy.error.placeholderMissing', vars: { names: missing.map((n) => `{${n}}`).join(' ') } }
  if (extra.length) return { key: 'dash.copy.error.placeholderExtra', vars: { names: extra.map((n) => `{${n}}`).join(' ') } }

  const cap = lengthCap(locale, key)
  if (text.length > cap) return { key: 'dash.copy.error.tooLong', vars: { max: cap } }
  if (MARKUP.test(text)) return { key: 'dash.copy.error.markup' }

  // Placeholders are Latin names; they do not count towards the language.
  const words = text.replace(PLACEHOLDER, '')
  if (locale === 'en' && count(words, ARABIC_LETTERS) > count(words, LATIN_LETTERS)) {
    return { key: 'dash.copy.error.arabicInEnglish' }
  }
  // Arabic keeps Latin runs it needs («رقم IBAN», «1080p و 4K»); only a
  // value with no Arabic at all, where the original had some, is refused.
  if (locale === 'ar' && count(original, ARABIC_LETTERS) > 0 && count(words, ARABIC_LETTERS) === 0) {
    return { key: 'dash.copy.error.englishInArabic' }
  }

  const rules = [...BANNED_CLAIMS, ...SITE_BANS, ...(key.startsWith('email.') ? MAIL_BANS : [])]
  for (const [pattern, why] of rules) {
    const found = pattern.exec(text)
    if (found) return { key: 'dash.copy.error.claim', vars: { words: found[0], why } }
  }
  return null
}
