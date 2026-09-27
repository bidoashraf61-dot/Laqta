/**
 * Claims the site copy must never make.
 *
 * One list, read in two places: `scripts/verify-licence.ts` scans the code
 * copy (messages, content/legal.ts) and every published page version, and
 * `lib/documents.ts` refuses to publish a page that contains one (DEV-64a).
 * Before the pages were editable the gate alone was enough; once the owner can
 * publish from admin, a banned claim has to be stopped at the button, not
 * found by the next build.
 */

/**
 * Phrasing that only makes sense in a world with more than one licence.
 *
 * A NUMBER is required for the cap patterns. An earlier version matched the
 * bare phrase "view cap" and flagged the correct licence, whose English text
 * reads "with no view cap" — a check that fires on the negation of the thing
 * it is looking for is worse than no check.
 */
export const CONTRADICTIONS: Array<[RegExp, string]> = [
  [/بحد أقصى[^.]{0,40}[\d٠-٩]/u, 'caps the number of views'],
  [/(?:up to|maximum of)\s+[\d,.]+\s*(?:million\s*)?views/i, 'caps the number of views'],
  [/الترخيص القياسي|standard licen[cs]e/i, 'names a "standard" tier'],
  [/الترخيص الموسّع|extended licen[cs]e/i, 'names an "extended" tier'],
]

/**
 * Claims the copy has made and the product cannot back.
 *
 * The launch catalogue is AI-generated, so "real locations" and "permits
 * cleared" are false about it (specs/public/index.md). A price comparison names
 * a competitor by implication and cannot be substantiated. "Every use" is false
 * while the licence excludes reselling the clip itself.
 */
export const OVERCLAIMS: Array<[RegExp, string]> = [
  [/بسعر لقطة (?:مفردة|واحدة)|أرخص ب|cheaper than|\d+\s*(?:×|x|times) cheaper/i, 'compares price'],
  [/مواقع (?:سعودية )?حقيقية|actually shot|real locations/i, 'claims the footage was filmed on location'],
  [/تصاريح موثّقة|permits (?:and locations )?cleared|documented clearance/i, 'claims permits were cleared'],
  [/جميع الاستخدامات|every use\b|all uses\b/i, 'claims the licence covers every use'],
]

export const BANNED_CLAIMS = [...CONTRADICTIONS, ...OVERCLAIMS]

/** The first banned claim in `text`: the words that matched and why. */
export function findBannedClaim(text: string): { match: string; why: string } | null {
  for (const [pattern, why] of BANNED_CLAIMS) {
    const found = pattern.exec(text)
    if (found) return { match: found[0], why }
  }
  return null
}
