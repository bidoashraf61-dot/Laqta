import { activeBcp47 } from '@/lib/i18n'

/**
 * A country's name in the reader's language, from its ISO code.
 *
 * `Intl.DisplayNames` already knows every country in every locale the browser
 * ships, so storing a code and resolving it here means one value in the
 * database renders correctly on both storefronts. A stored display name could
 * only ever be in one language, and would be wrong on the other.
 *
 * Falls back to the raw code rather than throwing: an unrecognised or
 * mis-entered code should show as "XX" — visibly odd, correctable — not take
 * the account page down.
 */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([activeBcp47()], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * The countries offered in the nationality picker.
 *
 * Not every country on earth: a 200-item select is a scroll, not a choice.
 * These are the markets this catalogue's buyers and creators actually come
 * from — the GCC, the wider Arab world, and the three places agencies working
 * on Saudi campaigns tend to be headquartered.
 *
 * `countryName` renders each in the reader's own language, so the list needs no
 * translation of its own and cannot drift between the two storefronts.
 */
export const COUNTRIES = [
  'SA', 'AE', 'KW', 'QA', 'BH', 'OM',
  'EG', 'JO', 'LB', 'SY', 'IQ', 'YE', 'SD', 'MA', 'TN', 'DZ', 'LY', 'PS',
  'GB', 'US', 'FR', 'DE', 'IN', 'PK', 'PH', 'TR',
] as const
