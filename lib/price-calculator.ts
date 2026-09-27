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
 * action run the same arithmetic. The base comes from the price bands and the
 * multipliers, range and spread from the owner's settings (DEV-09c); the
 * caller passes both in.
 */

/** The album price range the owner set (decision D4, 2026-09-26) — defaults. */
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

/**
 * Every pricing parameter the owner controls (DEV-09c). The live values come
 * from `lib/pricing-config.ts#loadPricingConfig` (the `PricingSetting` row);
 * these are the defaults it falls back to, key by key.
 */
export type PricingConfig = {
  priceMin: number
  priceMax: number
  /** How far the creator's recommendation may sit from the suggestion, 0–0.5. */
  spread: number
  resolution: { sd720: number; hd1080: number; uhd4k: number }
  type: { ai_live_action: number; ai_animated_3d: number; ai_animated_2d: number; filmed: number }
  quality: { standard: number; good: number; exceptional: number }
}

export const DEFAULT_PRICING: PricingConfig = {
  priceMin: PRICE_MIN_USD,
  priceMax: PRICE_MAX_USD,
  spread: 0.15,
  resolution: { sd720: 0.6, hd1080: 1.0, uhd4k: 1.3 },
  type: { ai_live_action: 1.0, ai_animated_3d: 0.9, ai_animated_2d: 0.8, filmed: 1.25 },
  quality: { standard: 0.9, good: 1.0, exceptional: 1.15 },
}

export const RESOLUTIONS = ['sd720', 'hd1080', 'uhd4k'] as const
export const FOOTAGE_TYPES = ['ai_live_action', 'ai_animated_3d', 'ai_animated_2d', 'filmed'] as const
export const QUALITIES = ['standard', 'good', 'exceptional'] as const

export type Resolution = (typeof RESOLUTIONS)[number]
export type FootageType = (typeof FOOTAGE_TYPES)[number]
export type Quality = (typeof QUALITIES)[number]

/** A price the owner may set or approve at: inside the range, whole cents. */
export function parseAlbumPrice(raw: unknown, config: Pick<PricingConfig, 'priceMin' | 'priceMax'> = DEFAULT_PRICING): number | null {
  const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (String(raw ?? '').trim() === '' || !Number.isFinite(value)) return null
  if (value < config.priceMin || value > config.priceMax) return null
  if (Math.round(value * 100) !== value * 100) return null
  return value
}

export type Band = { minClips: number; maxClips: number | null; priceStandard: number }

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
  config?: PricingConfig
}) {
  const config = input.config ?? DEFAULT_PRICING
  const clamp = (value: number) => Math.min(config.priceMax, Math.max(config.priceMin, value))
  const count = Math.min(70, Math.max(30, input.clipCount))
  const band = bandForCount(count, input.bands)
  if (!band) return null
  const raw =
    band.priceStandard *
    config.resolution[input.resolution] *
    config.type[input.type] *
    config.quality[input.quality]
  const price = Math.round(clamp(raw))
  return {
    base: band.priceStandard,
    price,
    low: Math.round(clamp(price * (1 - config.spread))),
    high: Math.round(clamp(price * (1 + config.spread))),
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
