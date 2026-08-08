'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ownsAlbum, recomputeAlbumRating } from '@/lib/reviews'
import { revalidatePath } from 'next/cache'

const emailSchema = z.string().email()

/**
 * Launch waiting list.
 *
 * Idempotent by email so a double submit is not a duplicate, and it never
 * reports whether an address was already on the list — that would turn the
 * form into an email-enumeration oracle.
 */
export async function captureEmail(
  formData: FormData,
): Promise<{ ok: boolean; messageKey: string }> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { ok: false, messageKey: 'landing.notifyInvalid' }

  const email = parsed.data.toLowerCase()

  try {
    await db.cmsEntry.upsert({
      where: { kind_slug: { kind: 'landing_copy', slug: `waitlist:${email}` } },
      update: {},
      create: {
        kind: 'landing_copy',
        slug: `waitlist:${email}`,
        status: 'draft',
        titleAr: 'تسجيل في قائمة الانتظار',
        titleEn: 'Launch waiting list signup',
        bodyAr: email,
        bodyEn: email,
      },
    })
  } catch {
    // A storage failure must not tell the visitor their address is invalid.
    return { ok: false, messageKey: 'auth.somethingWentWrong' }
  }

  return { ok: true, messageKey: 'landing.notifyThanks' }
}

const requestSchema = z.object({
  brief: z.string().trim().min(6).max(600),
  email: z.string().trim().email(),
})

/**
 * A buyer asking for footage that does not exist yet.
 *
 * The one feature the Arabic competitors cannot copy cheaply: a request for a
 * location in a season nobody shot is a production job here, not an
 * expedition. It is also the cheapest demand signal in the product — each row
 * is a customer naming what to build next, with an address to notify.
 *
 * No account required. Most requests will come from people who have not signed
 * up, and requiring an account first is how you never hear the request.
 */
export async function requestFootage(
  formData: FormData,
): Promise<{ ok: boolean; messageKey: string }> {
  const parsed = requestSchema.safeParse({
    brief: formData.get('brief'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { ok: false, messageKey: 'request.invalid' }

  try {
    await db.footageRequest.create({
      data: {
        briefAr: parsed.data.brief,
        email: parsed.data.email.toLowerCase(),
        locationSlug: (formData.get('location') as string) || null,
      },
    })
  } catch {
    // A storage failure must not read to the visitor as "your request was bad".
    return { ok: false, messageKey: 'auth.somethingWentWrong' }
  }

  return { ok: true, messageKey: 'request.received' }
}

const reviewSchema = z.object({
  albumId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(1200).optional(),
})

/**
 * Leave a verdict on an album you own.
 *
 * ── Ownership is enforced, not encouraged ──────────────────────────────────
 * A review is worth something only because the person writing it paid. Without
 * an `Entitlement` there is no review, which puts review-bombing and
 * competitor sabotage a purchase away rather than a signup away.
 *
 * ── Upsert, not create ─────────────────────────────────────────────────────
 * One verdict per buyer per album. A buyer who changes their mind should be
 * able to say so; stacking ten reviews from one account should be impossible.
 * The unique constraint backs this up at the database level.
 */
export async function reviewAlbum(
  formData: FormData,
): Promise<{ ok: boolean; messageKey: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, messageKey: 'review.signInFirst' }

  const parsed = reviewSchema.safeParse({
    albumId: formData.get('albumId'),
    rating: formData.get('rating'),
    body: formData.get('body') || undefined,
  })
  if (!parsed.success) return { ok: false, messageKey: 'review.invalid' }

  const { albumId, rating, body } = parsed.data

  if (!(await ownsAlbum(session.user.id, albumId))) {
    return { ok: false, messageKey: 'review.mustOwn' }
  }

  try {
    await db.albumReview.upsert({
      where: { albumId_userId: { albumId, userId: session.user.id } },
      update: { rating, bodyAr: body ?? null },
      create: { albumId, userId: session.user.id, rating, bodyAr: body ?? null },
    })
    await recomputeAlbumRating(albumId)
  } catch {
    return { ok: false, messageKey: 'auth.somethingWentWrong' }
  }

  revalidatePath('/albums', 'layout')
  return { ok: true, messageKey: 'review.thanks' }
}
