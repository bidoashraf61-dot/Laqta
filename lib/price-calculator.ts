/**
 * The album price calculator (owner, 2026-09-27; DEV-08).
 *
 *   suggested = base(clip count) × resolution × footage type × quality
 *
 * clamped to $49–$249 and rounded to whole dollars. The creator sees it live
 * on the album details form and must recommend a price inside
 * `suggested ± SPREAD`; the owner confirms or counters at review.
 *
 * Pure — no database, no server imports — so the client form and the server
 * action run the same arithmetic. The base comes from the price bands (the
 * caller passes them in); the multipliers are the owner's starting values and
 * move to an admin editor later (DEV-09c).
 */

/** The album price range the owner set (decision D4, 2026-09-26). */
export const PRICE_MIN_USD = 49
export const PRICE_MAX_USD = 249

/** The band whose clip range holds `clipCount`, if any. */
export function bandForCount<T extends { minClips: number; maxClips: number | null }>(
  clipCount: number,
  bands: T[],
): T | null {
  return (
    bands.find(
      (band) => clipCount >= band.minClips && clipCount <= (band.maxClips ?? Number.POSITIVE_INFINITY),
    ) ?? null
  )
}

export const RESOLUTION_FACTOR = { sd720: 0.6, hd1080: 1.0, uhd4k: 1.3 } as const
/** Footage type as the form offers it: three generated styles, or filmed. */
export const TYPE_FACTOR = {
  ai_live_action: 1.0,
  ai_animated_3d: 0.9,
  ai_animated_2d: 0.8,
  filmed: 1.25,
} as const
export const QUALITY_FACTOR = { standard: 0.9, good: 1.0, exceptional: 1.15 } as const

/** How far the creator's recommendation may sit from the suggestion. */
export const SPREAD = 0.15

export type Resolution = keyof typeof RESOLUTION_FACTOR
export type FootageType = keyof typeof TYPE_FACTOR
export type Quality = keyof typeof QUALITY_FACTOR

export type Band = { minClips: number; maxClips: number | null; priceStandard: number }

const clamp = (value: number) => Math.min(PRICE_MAX_USD, Math.max(PRICE_MIN_USD, value))

/**
 * The suggestion and the range a recommendation must fall in. `null` when no
 * band covers the count. A count below 30 is priced as 30 (the album is not
 * finished yet) and above 70 as 70, so the creator sees a number while they
 * are still uploading — the submission gate re-checks against the real count.
 */
export function suggestPrice(input: {
  clipCount: number
  resolution: Resolution
  type: FootageType
  quality: Quality
  bands: Band[]
}) {
  const count = Math.min(70, Math.max(30, input.clipCount))
  const band = bandForCount(count, input.bands)
  if (!band) return null
  const raw =
    band.priceStandard *
    RESOLUTION_FACTOR[input.resolution] *
    TYPE_FACTOR[input.type] *
    QUALITY_FACTOR[input.quality]
  const price = Math.round(clamp(raw))
  return {
    base: band.priceStandard,
    price,
    low: Math.round(clamp(price * (1 - SPREAD))),
    high: Math.round(clamp(price * (1 + SPREAD))),
  }
}

/** Map the form's footage type onto the Album columns. */
export function typeToColumns(type: FootageType) {
  if (type === 'filmed') return { origin: 'captured' as const, footageStyle: 'live_action' as const }
  const style = type === 'ai_animated_3d' ? 'animated_3d' : type === 'ai_animated_2d' ? 'animated_2d' : 'live_action'
  return { origin: 'generated' as const, footageStyle: style as 'live_action' | 'animated_3d' | 'animated_2d' }
}

/** …and back, for a saved album. */
export function columnsToType(origin: string, style: string | null): FootageType {
  if (origin === 'captured') return 'filmed'
  if (style === 'animated_3d') return 'ai_animated_3d'
  if (style === 'animated_2d') return 'ai_animated_2d'
  return 'ai_live_action'
}
