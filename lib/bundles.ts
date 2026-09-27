import type { CreatorTier, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { resolveCommission } from '@/lib/commission'
import { recordAudit } from '@/lib/audit'
import { BANNED_CLAIMS, SITE_BANS } from '@/lib/copy-claims'
import { OFFER_SELECT, priceNow, type OfferFields } from '@/lib/offers'
import { BUNDLE_LIMITS, overCeiling, priceBundle, type AppliedBundle, type BundleLine } from '@/lib/bundle-pricing'

export { BUNDLE_LIMITS, bundledCommission, overCeiling, priceBundle } from '@/lib/bundle-pricing'
export type { AppliedBundle, BundleLine } from '@/lib/bundle-pricing'

/**
 * Album bundles (DEV-62).
 *
 * ── Who pays the discount ───────────────────────────────────────────────────
 * Laqta, from its commission (owner decision, 2026-09-27). Each creator is
 * paid exactly what they would have earned selling the album on its own: the
 * creator's net is computed on the album's price before the bundle, and the
 * bundle discount comes out of the platform's share.
 *
 * That puts a ceiling on a bundle: on no album may the discount exceed
 * Laqta's commission on it, or Laqta would pay the creator more than the buyer
 * paid. The ceiling is checked when the owner saves a bundle AND again at
 * checkout, because an album's price or its creator's rate can change after.
 * A bundle over the ceiling at checkout is simply not applied.
 *
 * ── How it applies ──────────────────────────────────────────────────────────
 * Automatically: when the cart holds every album of a running bundle, the
 * bundle price applies. «اشترِ الحزمة» on the bundle page puts them all in the
 * cart. Overlapping bundles: the biggest saving wins, then the next that
 * shares no album with it. Promo codes apply only to albums not in an applied
 * bundle — discounts do not stack.
 */

/** Running at `now`: active and inside its dates. */
export function bundleRunningWhere(now = new Date()): Prisma.BundleWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  }
}

/**
 * Which running bundles a set of lines completes, and each one's discount.
 * Bundles over the Laqta-share ceiling are skipped. Pass a transaction client
 * from checkout so the read is part of the order.
 */
export async function resolveBundles(
  lines: BundleLine[],
  now = new Date(),
  client: Prisma.TransactionClient | typeof db = db,
): Promise<{ applied: AppliedBundle[]; discounts: Record<string, number>; bundleOf: Record<string, string> }> {
  const empty = { applied: [], discounts: {}, bundleOf: {} }
  if (lines.length < BUNDLE_LIMITS.minAlbums) return empty
  const inCart = new Set(lines.map((line) => line.albumId))
  const byAlbum = new Map(lines.map((line) => [line.albumId, line]))

  const candidates = await client.bundle.findMany({
    where: { ...bundleRunningWhere(now), albums: { some: { albumId: { in: [...inCart] } } } },
    include: { albums: { orderBy: { position: 'asc' }, select: { albumId: true } } },
  })

  const priced = candidates
    .filter((bundle) => bundle.albums.length >= BUNDLE_LIMITS.minAlbums && bundle.albums.every((a) => inCart.has(a.albumId)))
    .flatMap((bundle) => {
      const bundleLines = bundle.albums.map((a) => byAlbum.get(a.albumId)!)
      const result = priceBundle(bundle.pricing, Number(bundle.value), bundleLines)
      if (!result) return []
      const over = overCeiling(bundleLines, result.discounts)
      if (over.length) {
        console.warn(`[bundles] ${bundle.slug} exceeds Laqta's share on ${over.length} album(s); not applied`)
        return []
      }
      return [
        {
          bundleId: bundle.id,
          slug: bundle.slug,
          titleAr: bundle.titleAr,
          titleEn: bundle.titleEn,
          ...result,
        } satisfies AppliedBundle,
      ]
    })
    .sort((a, b) => b.discount - a.discount)

  const taken = new Set<string>()
  const applied: AppliedBundle[] = []
  for (const bundle of priced) {
    const albums = Object.keys(bundle.discounts)
    if (albums.some((id) => taken.has(id))) continue
    albums.forEach((id) => taken.add(id))
    applied.push(bundle)
  }

  const discounts: Record<string, number> = {}
  const bundleOf: Record<string, string> = {}
  for (const bundle of applied) {
    for (const [albumId, amount] of Object.entries(bundle.discounts)) {
      discounts[albumId] = amount
      bundleOf[albumId] = bundle.bundleId
    }
  }
  return { applied, discounts, bundleOf }
}

/** The commission rate a line would carry — what the ceiling is measured against. */
export function lineRate(album: {
  isExclusive: boolean
  creator: { tier: CreatorTier; commissionRateOverride: unknown }
}, gross: number) {
  return resolveCommission({
    grossAmount: gross,
    tier: album.creator.tier,
    isExclusive: album.isExclusive,
    override: album.creator.commissionRateOverride ? Number(album.creator.commissionRateOverride) : null,
  }).rate
}

/** What checkout, the cart and the admin need to price albums against bundles. */
export const BUNDLE_ALBUM_SELECT = {
  id: true,
  isExclusive: true,
  ...OFFER_SELECT,
  creator: { select: { tier: true, commissionRateOverride: true } },
} satisfies Prisma.AlbumSelect

type PricedAlbum = OfferFields & {
  id: string
  isExclusive: boolean
  creator: { tier: CreatorTier; commissionRateOverride: unknown }
}

/** Lines for `resolveBundles` — from albums selected with `BUNDLE_ALBUM_SELECT` (or a superset). */
export function bundleLines(albums: PricedAlbum[], now = new Date()): BundleLine[] {
  return albums.map((album) => {
    const gross = priceNow(album, now).priceStandard
    return { albumId: album.id, gross, rate: lineRate(album, gross) }
  })
}

/**
 * Running bundles an album is part of, that a buyer could buy right now (every
 * album live, within the ceiling), with their saving — for the album page.
 */
export async function buyableBundlesFor(albumId: string, now = new Date()) {
  const bundles = await db.bundle.findMany({
    where: { ...bundleRunningWhere(now), albums: { some: { albumId } } },
    include: {
      albums: {
        orderBy: { position: 'asc' },
        include: { album: { select: { ...BUNDLE_ALBUM_SELECT, status: true } } },
      },
    },
  })
  return bundles.flatMap((bundle) => {
    const albums = bundle.albums.map((row) => row.album)
    if (albums.some((album) => album.status !== 'live' || Number(album.priceStandard) <= 0)) return []
    const lines = bundleLines(albums, now)
    const priced = priceBundle(bundle.pricing, Number(bundle.value), lines)
    if (!priced || overCeiling(lines, priced.discounts).length) return []
    return [{ slug: bundle.slug, titleAr: bundle.titleAr, titleEn: bundle.titleEn, discount: priced.discount }]
  })
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export type BundleInput = {
  id?: string | null
  slug: string
  titleAr: string
  titleEn?: string | null
  descriptionAr?: string | null
  descriptionEn?: string | null
  pricing: string
  value: number
  startsAt?: Date | null
  endsAt?: Date | null
  isActive: boolean
  albumIds: string[]
}

export type BundleSaveResult =
  | { ok: true; id: string }
  | { ok: false; error: { key: string; vars?: Record<string, string | number> } }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Create or update a bundle from `/admin/bundles` — every rule checked here,
 * not only in the form. The Laqta-share ceiling is measured at today's prices
 * and rates. Audited with before/after.
 */
export async function saveBundle(input: BundleInput, actorId: string): Promise<BundleSaveResult> {
  const fail = (key: string, vars?: Record<string, string | number>) => ({ ok: false as const, error: { key: `dash.bundles.error.${key}`, vars } })
  const text = (value: string | null | undefined, max: number) => (value ?? '').trim().slice(0, max)
  const titleAr = text(input.titleAr, 80)
  const titleEn = text(input.titleEn, 80)
  const descriptionAr = text(input.descriptionAr, 600)
  const descriptionEn = text(input.descriptionEn, 600)
  const slug = text(input.slug, 60).toLowerCase()

  if (!titleAr) return fail('title')
  if (slug.length < 3 || !SLUG.test(slug)) return fail('slug')
  const clash = await db.bundle.findUnique({ where: { slug }, select: { id: true } })
  if (clash && clash.id !== input.id) return fail('slugTaken')

  for (const value of [titleAr, titleEn, descriptionAr, descriptionEn]) {
    if (!value) continue
    for (const [pattern] of [...BANNED_CLAIMS, ...SITE_BANS]) {
      const found = pattern.exec(value)
      if (found) return fail('claim', { words: found[0] })
    }
  }

  const albumIds = [...new Set(input.albumIds)]
  if (albumIds.length < BUNDLE_LIMITS.minAlbums || albumIds.length > BUNDLE_LIMITS.maxAlbums) {
    return fail('albumCount', { min: BUNDLE_LIMITS.minAlbums, max: BUNDLE_LIMITS.maxAlbums })
  }
  const albums = await db.album.findMany({
    where: { id: { in: albumIds }, status: 'live', priceStandard: { gt: 0 } },
    select: BUNDLE_ALBUM_SELECT,
  })
  if (albums.length !== albumIds.length) return fail('albumsLive')
  const ordered = albumIds.map((id) => albums.find((album) => album.id === id)!)

  if (input.pricing !== 'percent_off' && input.pricing !== 'fixed_price') return fail('pricing')
  const value = Number(input.value)
  if (!Number.isFinite(value) || Math.round(value * 100) !== value * 100) return fail('value')
  if (input.pricing === 'percent_off' && (value < 1 || value > BUNDLE_LIMITS.maxPercent)) {
    return fail('percent', { max: BUNDLE_LIMITS.maxPercent })
  }
  const lines = bundleLines(ordered)
  const priced = priceBundle(input.pricing, value, lines)
  if (input.pricing === 'fixed_price' && (value <= 0 || !priced)) {
    return fail('fixed', { regular: lines.reduce((sum, line) => sum + line.gross, 0) })
  }
  if (!priced) return fail('value')
  const over = overCeiling(lines, priced.discounts)
  if (over.length) {
    const maxPercent = Math.floor(Math.min(...lines.map((line) => line.rate)) * 100)
    return fail('ceiling', { count: over.length, max: maxPercent })
  }

  const startsAt = input.startsAt ?? null
  const endsAt = input.endsAt ?? null
  if (endsAt && (endsAt <= new Date() || (startsAt && endsAt <= startsAt))) return fail('dates')

  const data = {
    slug,
    titleAr,
    titleEn: titleEn || null,
    descriptionAr: descriptionAr || null,
    descriptionEn: descriptionEn || null,
    pricing: input.pricing,
    value,
    startsAt,
    endsAt,
    isActive: input.isActive,
  } as const
  const before = input.id
    ? await db.bundle.findUnique({ where: { id: input.id }, include: { albums: { select: { albumId: true } } } })
    : null
  if (input.id && !before) return { ok: false, error: { key: 'state.notFound' } }

  const saved = await db.$transaction(async (tx) => {
    const bundle = input.id
      ? await tx.bundle.update({ where: { id: input.id }, data })
      : await tx.bundle.create({ data })
    await tx.bundleAlbum.deleteMany({ where: { bundleId: bundle.id } })
    await tx.bundleAlbum.createMany({
      data: albumIds.map((albumId, position) => ({ bundleId: bundle.id, albumId, position })),
    })
    return bundle
  })
  await recordAudit({
    actorId,
    action: input.id ? 'bundle.update' : 'bundle.create',
    entity: 'Bundle',
    entityId: saved.id,
    detail: {
      before: before ? { ...before, albums: before.albums.map((a) => a.albumId) } : null,
      after: { ...data, albumIds, regular: priced.regular, price: priced.price },
    },
  })
  return { ok: true, id: saved.id }
}

/** Switch a bundle on or off. Past orders keep their bundle price. Audited. */
export async function setBundleActive(id: string, isActive: boolean, actorId: string) {
  const bundle = await db.bundle.findUnique({ where: { id }, select: { id: true } })
  if (!bundle) return false
  await db.bundle.update({ where: { id }, data: { isActive } })
  await recordAudit({ actorId, action: isActive ? 'bundle.activate' : 'bundle.deactivate', entity: 'Bundle', entityId: id })
  return true
}
