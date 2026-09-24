import type { AlbumTier } from '@prisma/client'
import { MAX_ALBUM_CLIPS, MIN_ALBUM_CLIPS } from '@/lib/studio'

/**
 * Price bands — the rules the editor on `/admin/catalogue` enforces.
 *
 * ── What a band price reaches ───────────────────────────────────────────────
 * A band is read at exactly one moment: when a creator creates a draft album
 * (`app/(studio)/studio/actions.ts#createAlbum`), which COPIES the band's price
 * onto `Album.priceStandard`. Nothing re-reads it afterwards. So editing a band
 * changes the price of albums created from then on, and nothing else:
 *   - live, paused and draft albums keep the price they were created with;
 *   - completed orders are further away still — each `OrderItem` froze its
 *     gross, VAT and commission at purchase (lib/orders.ts) and no code path
 *     from here reaches it.
 * The editor says this in words, and `verify:flows` asserts no album moves.
 *
 * The owner's 2026-08-20 decision ("editing a band reprices live albums and
 * notifies their creators") is NOT implemented: repricing needs the creator
 * notification (and Spec B's accept-the-price step) to exist first, and a
 * silent reprice would sell creators at a price they never agreed to.
 */

export const ALBUM_TIERS: AlbumTier[] = ['mini', 'standard', 'pro', 'signature']

export type BandInput = {
  id?: string
  tier: string
  labelAr: string
  labelEn: string
  minClips: number
  maxClips: number | null
  priceStandard: number
}

export type BandRow = {
  id: string
  tier: string
  labelAr: string
  minClips: number
  maxClips: number | null
}

export type BandError =
  | { key: 'dash.bandLabelRequired' }
  | { key: 'dash.bandCountsInvalid' }
  | { key: 'dash.bandMinMax' }
  | { key: 'dash.bandPricePositive' }
  | { key: 'dash.bandTierTaken' }
  | { key: 'state.error' }
  | { key: 'dash.bandOverlap'; vars: { label: string } }

/** Two inclusive clip ranges overlap; `null` max is open-ended. */
function overlaps(a: { minClips: number; maxClips: number | null }, b: { minClips: number; maxClips: number | null }) {
  const aMax = a.maxClips ?? Number.POSITIVE_INFINITY
  const bMax = b.maxClips ?? Number.POSITIVE_INFINITY
  return a.minClips <= bMax && b.minClips <= aMax
}

/** Validate a band against the others. Returns the first problem, or null. */
export function validateBand(input: BandInput, others: BandRow[]): BandError | null {
  if (!(ALBUM_TIERS as string[]).includes(input.tier)) return { key: 'state.error' }
  if (!input.labelAr.trim() || !input.labelEn.trim()) return { key: 'dash.bandLabelRequired' }
  if (
    !Number.isInteger(input.minClips) ||
    input.minClips < 1 ||
    (input.maxClips !== null && (!Number.isInteger(input.maxClips) || input.maxClips < 1))
  ) {
    return { key: 'dash.bandCountsInvalid' }
  }
  if (input.maxClips !== null && input.minClips > input.maxClips) return { key: 'dash.bandMinMax' }
  if (!Number.isFinite(input.priceStandard) || input.priceStandard <= 0 || input.priceStandard > 100_000) {
    return { key: 'dash.bandPricePositive' }
  }

  const rest = others.filter((band) => band.id !== input.id)
  if (rest.some((band) => band.tier === input.tier)) return { key: 'dash.bandTierTaken' }
  const clash = rest.find((band) => overlaps(input, band))
  if (clash) return { key: 'dash.bandOverlap', vars: { label: clash.labelAr } }
  return null
}

/**
 * Where a band sits against the 30–70 clip album the studio gate enforces.
 * `outside` — no album can be in it; `partial` — part of its range is
 * unreachable; `inside` — every count in it is a legal album.
 */
export function bandFit(band: { minClips: number; maxClips: number | null }) {
  const max = band.maxClips ?? Number.POSITIVE_INFINITY
  if (max < MIN_ALBUM_CLIPS || band.minClips > MAX_ALBUM_CLIPS) return 'outside' as const
  if (band.minClips < MIN_ALBUM_CLIPS || max > MAX_ALBUM_CLIPS) return 'partial' as const
  return 'inside' as const
}

/** Parse the editor's form. Blank max = open-ended. */
export function parseBandForm(formData: FormData): BandInput {
  const text = (name: string) => String(formData.get(name) ?? '').trim()
  const maxRaw = text('maxClips')
  return {
    id: text('id') || undefined,
    tier: text('tier'),
    labelAr: text('labelAr'),
    labelEn: text('labelEn'),
    minClips: Number(text('minClips')),
    maxClips: maxRaw === '' ? null : Number(maxRaw),
    priceStandard: Number(text('priceStandard')),
  }
}
