import type { BundlePricing } from '@prisma/client'

/**
 * Bundle arithmetic (DEV-62) — pure, so the admin editor previews exactly what
 * checkout will charge. The rules and the reasons are in `lib/bundles.ts`.
 */

export const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const BUNDLE_LIMITS = { minAlbums: 2, maxAlbums: 12, maxPercent: 90 } as const

/** A cart or order line as bundles see it: the album's price now and its commission rate. */
export type BundleLine = { albumId: string; gross: number; rate: number }

export type AppliedBundle = {
  bundleId: string
  slug: string
  titleAr: string
  titleEn: string | null
  /** Sum of the albums' prices before the bundle. */
  regular: number
  /** What the buyer pays for the bundle's albums (before VAT). */
  price: number
  discount: number
  /** Per album id: this line's share of the discount. */
  discounts: Record<string, number>
}

/**
 * A bundle's discount on a set of lines, split across them by price (the
 * last line takes the rounding remainder), or null when it gives nothing.
 */
export function priceBundle(
  pricing: BundlePricing,
  value: number,
  lines: Array<{ albumId: string; gross: number }>,
): { regular: number; price: number; discount: number; discounts: Record<string, number> } | null {
  const regular = cents(lines.reduce((sum, line) => sum + line.gross, 0))
  if (regular <= 0) return null
  const wanted =
    pricing === 'percent_off'
      ? cents((regular * Math.min(BUNDLE_LIMITS.maxPercent, Math.max(0, value))) / 100)
      : cents(Math.max(0, regular - Math.max(0, value)))
  if (wanted <= 0) return null
  const discounts: Record<string, number> = {}
  let given = 0
  lines.forEach((line, index) => {
    const share = index === lines.length - 1 ? cents(wanted - given) : cents((wanted * line.gross) / regular)
    discounts[line.albumId] = Math.min(line.gross, Math.max(0, share))
    given = cents(given + discounts[line.albumId])
  })
  return { regular, price: cents(regular - given), discount: given, discounts }
}

/**
 * The albums whose discount would exceed Laqta's commission on them — empty
 * when the bundle is within its ceiling.
 */
export function overCeiling(lines: BundleLine[], discounts: Record<string, number>): string[] {
  return lines
    .filter((line) => (discounts[line.albumId] ?? 0) > cents(line.gross * line.rate))
    .map((line) => line.albumId)
}

/**
 * A bundled line's money, Laqta paying the discount: the creator's net is what
 * the album earns on its own; the platform keeps the rest of what was paid.
 * `commissionRate` is the effective rate on the price paid, so a partial
 * refund reverses in proportion (a full refund reverses the exact amounts —
 * lib/admin.ts#refundOrderItem).
 */
export function bundledCommission({
  preDiscount,
  discount,
  standalone,
}: {
  preDiscount: number
  discount: number
  standalone: { creatorNetAmount: number; rate: number; basis: object }
}) {
  const paid = cents(preDiscount - discount)
  const creatorNetAmount = standalone.creatorNetAmount
  const commissionAmount = cents(paid - creatorNetAmount)
  const rate = paid > 0 ? Math.round((commissionAmount / paid) * 10_000) / 10_000 : 0
  return {
    paid,
    rate,
    commissionAmount,
    creatorNetAmount,
    basis: {
      ...standalone.basis,
      effectiveRate: rate,
      standaloneRate: standalone.rate,
      bundle: { preDiscountGross: preDiscount, discount, fundedBy: 'platform' },
    },
  }
}

