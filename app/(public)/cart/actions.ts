'use server'

import { revalidatePath } from 'next/cache'
import { OFFER_SELECT, priceNow } from '@/lib/offers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { vatOn } from '@/lib/commission'

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

  const cart = await db.cart.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  })

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
  if (!cart) return { items: [], subtotal: 0, vatAmount: 0, total: 0 }

  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.unitPrice), 0)
  const vatAmount = cart.items.reduce((sum, item) => sum + Number(item.vatAmount), 0)

  return { items: cart.items, subtotal, vatAmount, total: subtotal + vatAmount }
}
