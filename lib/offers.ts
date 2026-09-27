import type { Prisma } from '@prisma/client'

/**
 * Album offers (DEV-60) — decided at read time.
 *
 * An album has a REGULAR price (`priceStandard`) and, optionally, an offer:
 * `offerPrice` running from `offerStartsAt` (NULL = already) until
 * `offerEndsAt` (NULL = until the owner removes it). Nothing flips a flag when
 * an offer starts or ends — every page, the cart and checkout ask `priceNow`
 * at the moment they need it, so an offer begins and stops on its dates with
 * no scheduled job, and a buyer is never charged an offer that has ended.
 *
 * `priceNow` returns the SAME shape the storefront always used: the price
 * paid now as `priceStandard`, and the struck-through regular price as
 * `compareAtPrice` (NULL when no offer is running). So the album card, the
 * licence panel and every mapping keep their meaning unchanged.
 */

export type OfferFields = {
  priceStandard: unknown
  offerPrice: unknown
  offerStartsAt: Date | null
  offerEndsAt: Date | null
  offerLabelAr: string | null
  offerLabelEn: string | null
}

/** The columns `priceNow` reads — spread into any album `select`. */
export const OFFER_SELECT = {
  priceStandard: true,
  offerPrice: true,
  offerStartsAt: true,
  offerEndsAt: true,
  offerLabelAr: true,
  offerLabelEn: true,
} as const

export function offerRunning(album: Omit<OfferFields, 'offerLabelAr' | 'offerLabelEn'>, now = new Date()) {
  if (album.offerPrice == null) return false
  const offer = Number(album.offerPrice)
  if (!(offer > 0) || offer >= Number(album.priceStandard)) return false
  if (album.offerStartsAt && album.offerStartsAt > now) return false
  if (album.offerEndsAt && album.offerEndsAt <= now) return false
  return true
}

export function priceNow(album: OfferFields, now = new Date()) {
  const running = offerRunning(album, now)
  return {
    priceStandard: running ? Number(album.offerPrice) : Number(album.priceStandard),
    compareAtPrice: running ? Number(album.priceStandard) : null,
    offerLabelAr: running ? album.offerLabelAr : null,
    offerLabelEn: running ? album.offerLabelEn : null,
  }
}

/** Prisma filter: an offer is running now. For the offers rail and lists. */
export function offerRunningWhere(now = new Date()): Prisma.AlbumWhereInput {
  return {
    offerPrice: { not: null },
    AND: [
      { OR: [{ offerStartsAt: null }, { offerStartsAt: { lte: now } }] },
      { OR: [{ offerEndsAt: null }, { offerEndsAt: { gt: now } }] },
    ],
  }
}
