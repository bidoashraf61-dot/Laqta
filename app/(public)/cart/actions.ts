'use server'

import { revalidatePath } from 'next/cache'
import { OFFER_SELECT, priceNow } from '@/lib/offers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { vatOn } from '@/lib/commission'
import { BUNDLE_ALBUM_SELECT, bundleLines, bundleRunningWhere, resolveBundles } from '@/lib/bundles'

/**
 * Cart operations.
 *
 * The cart is per-user and lives in the database rather than a cookie: a buyer
 * who shortlists on a laptop and pays on a phone is the normal agency
 * workflow, not an edge case.
 */

export async function addToCart(albumSlugPath: string) {
  const session = await auth()
  if (!session?.user) return { ok: false, messageKey: 'auth.signIn' }

  const [handle, slug] = albumSlugPath.split('/')
  const album = await db.album.findFirst({
    where: { slug, status: 'live', creator: { handle } },
    select: { id: true, ...OFFER_SELECT },
  })
  if (!album) return { ok: false, messageKey: 'cart.unavailable' }

  await putInCart(session.user.id, [album])
  revalidatePath('/cart')
  return { ok: true, messageKey: 'cart.added' }
}

async function putInCart(userId: string, albums: Array<{ id: string } & Parameters<typeof priceNow>[0]>) {
  const cart = await db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })

  for (const album of albums) {
    // The price NOW, offer included (DEV-60). Display only — checkout prices
    // the album again when the order is placed.
    const unitPrice = priceNow(album).priceStandard
    await db.cartItem.upsert({
      where: { cartId_albumId: { cartId: cart.id, albumId: album.id } },
      update: { unitPrice, vatAmount: vatOn(unitPrice) },
      create: {
        cartId: cart.id,
        albumId: album.id,
        unitPrice,
        vatAmount: vatOn(unitPrice),
      },
    })
  }
}

/**
 * «اشترِ الحزمة» (DEV-62): every live album of a running bundle the buyer
 * does not already own goes into the cart; the bundle price then applies at
 * checkout on its own. Refused when the bundle is not running or any of its
 * albums is no longer live — a partial bundle would not get the bundle price.
 */
export async function addBundleToCart(slug: string) {
  const session = await auth()
  if (!session?.user) return { ok: false, messageKey: 'auth.signIn' }

  const bundle = await db.bundle.findFirst({
    where: { slug, ...bundleRunningWhere() },
    include: { albums: { include: { album: { select: { id: true, status: true, ...OFFER_SELECT } } } } },
  })
  if (!bundle || bundle.albums.some((row) => row.album.status !== 'live' || Number(row.album.priceStandard) <= 0)) {
    return { ok: false, messageKey: 'bundle.unavailable' }
  }
  const owned = await db.entitlement.findMany({
    where: { userId: session.user.id, albumId: { in: bundle.albums.map((row) => row.albumId) }, revokedAt: null },
    select: { albumId: true },
  })
  const ownedIds = new Set(owned.map((row) => row.albumId))
  await putInCart(
    session.user.id,
    bundle.albums.map((row) => row.album).filter((album) => !ownedIds.has(album.id)),
  )
  revalidatePath('/cart')
  return { ok: true, messageKey: 'cart.added' }
}

export async function removeFromCart(albumId: string) {
  const session = await auth()
  if (!session?.user) return { ok: false, messageKey: 'auth.signIn' }

  const cart = await db.cart.findUnique({ where: { userId: session.user.id } })
  if (cart) {
    await db.cartItem.deleteMany({ where: { cartId: cart.id, albumId } })
  }
  revalidatePath('/cart')
  return { ok: true, messageKey: 'actions.delete' }
}

export async function getCart(userId: string) {
  const cart = await db.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          album: {
            select: {
              id: true,
              slug: true,
              titleAr: true,
              titleEn: true,
              currency: true,
              clipCount: true,
              clearanceStatus: true,
              creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
            },
          },
        },
      },
    },
  })
  if (!cart) return { items: [], bundles: [], bundleDiscount: 0, subtotal: 0, vatAmount: 0, total: 0 }

  // Bundles this cart completes (DEV-62), priced as checkout will price them.
  // The line prices shown stay the stored ones; the bundle saving is its own
  // row, and the totals are after it.
  const albums = await db.album.findMany({
    where: { id: { in: cart.items.map((item) => item.albumId) }, status: 'live', priceStandard: { gt: 0 } },
    select: BUNDLE_ALBUM_SELECT,
  })
  const { applied, discounts } = await resolveBundles(bundleLines(albums))

  const paid = cart.items.map((item) => Math.round((Number(item.unitPrice) - (discounts[item.albumId] ?? 0)) * 100) / 100)
  const subtotal = paid.reduce((sum, value) => sum + value, 0)
  const vatAmount = paid.reduce((sum, value) => sum + vatOn(value), 0)
  const bundleDiscount = applied.reduce((sum, bundle) => sum + bundle.discount, 0)

  return {
    items: cart.items,
    bundles: applied.map((bundle) => ({
      slug: bundle.slug,
      titleAr: bundle.titleAr,
      titleEn: bundle.titleEn,
      discount: bundle.discount,
      albumIds: Object.keys(bundle.discounts),
    })),
    bundleDiscount,
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
  }
}
