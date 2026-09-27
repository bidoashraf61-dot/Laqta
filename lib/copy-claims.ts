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
 * The catalogue mixes filmed and AI-generated albums, so a blanket "real
 * locations" or "permits cleared" is false about part of it — how each album
 * was made is stated on the album (specs/public/index.md, DEV-20). A price comparison names
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

/**
 * Owner decisions that bind every public string, not only the licence:
 * refunds are never mentioned (2026-09-23), and no "first" / "largest" claim.
 * Moved here from `scripts/verify-mail.ts` so the copy editor (DEV-64b)
 * refuses them at publish as well.
 */
export const SITE_BANS: Array<[RegExp, string]> = [
  [/refund|reimburs|money[- ]back|استرد|استرجا|مسترد|إرجاع المبلغ/i, 'mentions refunds'],
  // The CLAIM, not the word: "browse the library first" is fine on /sell.
  [
    /\b(?:the )?(?:first|largest|biggest)\s+(?:saudi\s+|arabic\s+)?(?:stock|footage|library|platform|marketplace)\b|\blargest\b|\bbiggest\b|الأكبر|الأول(ى)? من نوع|أكبر مكتبة|أول مكتبة|أول منصة/i,
    'claims first or largest',
  ],
]

/**
 * Mail only, the rules verify:mail has always applied: none of the messages
 * may say the footage was filmed or shot anywhere, and none may use "first"
 * or "largest" at all.
 */
export const MAIL_BANS: Array<[RegExp, string]> = [
  // Mail keeps the stricter word-level rule verify:mail has always applied.
  [/\b(first|largest|biggest)\b/i, 'claims first or largest'],
  [/\bfilmed\b|\bshot (on|in|at)\b|on location|صُ?وِّ?رت? في|صوّرنا|صورناها|تم تصوير/i, 'claims the footage was filmed'],
]
