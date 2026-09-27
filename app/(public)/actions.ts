'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ownsAlbum, recomputeAlbumRating } from '@/lib/reviews'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createHash } from 'node:crypto'
import { requestLocale } from '@/lib/locale-request'
import { notifyContactMessage, notifyContactReceived, notifyRequestReceived } from '@/lib/notifications'
import { CONTACT_TOPICS } from '@/content/contact'
import { translate } from '@/lib/i18n'
import { joinWaitlist, waitlistSource } from '@/lib/waitlist'
import { hit } from '@/lib/rate-limit'

const emailSchema = z.string().email()

/**
 * Launch waiting list (DEV-45) — `lib/waitlist.ts`.
 *
 * Idempotent by email so a double submit is not a duplicate, and it never
 * reports whether an address was already on the list — that would turn the
 * form into an email-enumeration oracle. Records the page's language, where
 * the form was, and the consent wording shown under it.
 */
export async function captureEmail(
  formData: FormData,
): Promise<{ ok: boolean; messageKey: string }> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { ok: false, messageKey: 'landing.notifyInvalid' }

  const ipHash = await senderIpHash()
  if (ipHash && !hit('waitlist', ipHash, 20, 60 * 60_000).ok) return { ok: false, messageKey: 'auth.rateLimited' }

  try {
    await joinWaitlist({
      email: parsed.data,
      locale: await requestLocale(),
      source: waitlistSource(formData.get('source')),
      ipHash,
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
  // «وصلنا طلبك» in the page's language (DEV-30). Never fails the request.
  await notifyRequestReceived({ email: parsed.data.email, brief: parsed.data.brief, locale: await requestLocale() })

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

// ── Contact ─────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().trim().min(2, 'contact.errName').max(120, 'contact.errName'),
  email: z.string().trim().max(254, 'contact.errEmail').email('contact.errEmail'),
  topic: z.enum(CONTACT_TOPICS).optional(),
  message: z.string().trim().min(10, 'contact.errMessage').max(5000, 'contact.errMessageLong'),
})

export type ContactField = 'name' | 'email' | 'topic' | 'message'

export type ContactResult =
  | { ok: true }
  | { ok: false; messageKey: string; fieldErrors?: Partial<Record<ContactField, string>> }

/** Per sender IP: this many messages an hour. Generous for a person, not for a script. */
const CONTACT_PER_IP_PER_HOUR = 5
/** Per reply address: this many in ten minutes — a double-click is fine, a loop is not. */
const CONTACT_PER_EMAIL_PER_10_MIN = 3

async function senderIpHash() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || ''
  if (!ip) return null
  // Salted so the stored value cannot be reversed by hashing the IPv4 space.
  return createHash('sha256')
    .update(`${process.env.AUTH_SECRET ?? 'laqta'}:${ip}`)
    .digest('hex')
}

/**
 * A message from /contact.
 *
 * ── Stored first, mailed second ─────────────────────────────────────────────
 * The row is the record. The operator email is sent after it is committed and
 * its failure is swallowed: a visitor whose message is saved must never be
 * told it was not, and no mail provider is wired yet anyway. `mailDelivered`
 * records whether it left, so /admin/messages can show which ones nobody was
 * told about.
 *
 * ── Honeypot and rate limit ─────────────────────────────────────────────────
 * `website` is a field no person sees. A bot that fills it is thanked and
 * dropped — telling it why would teach it. The rate limit counts stored rows
 * rather than an in-memory map, so it holds across server instances and
 * restarts without another moving part.
 *
 * Returns message KEYS, translated by the client with `useT()`, so the reply
 * is in the language of the page that asked (see verify:action-locale).
 */
export async function sendContactMessage(formData: FormData): Promise<ContactResult> {
  const locale = await requestLocale()

  if (String(formData.get('website') ?? '').trim() !== '') return { ok: true }

  const topicRaw = String(formData.get('topic') ?? '')
  const parsed = contactSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    topic: topicRaw === '' ? undefined : topicRaw,
    message: formData.get('message') ?? '',
  })

  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message.startsWith('contact.') ? issue.message : 'contact.errTopic'
      }
    }
    return { ok: false, messageKey: 'contact.errSummary', fieldErrors }
  }

  const { name, email, topic, message } = parsed.data
  const replyTo = email.toLowerCase()

  let id: string
  try {
    const ipHash = await senderIpHash()
    const [byIp, byEmail] = await Promise.all([
      ipHash
        ? db.contactMessage.count({
            where: { ipHash, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
          })
        : Promise.resolve(0),
      db.contactMessage.count({
        where: { email: replyTo, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
      }),
    ])
    if (byIp >= CONTACT_PER_IP_PER_HOUR || byEmail >= CONTACT_PER_EMAIL_PER_10_MIN) {
      return { ok: false, messageKey: 'contact.rateLimited' }
    }

    const row = await db.contactMessage.create({
      data: { name, email: replyTo, topic: topic ?? null, message, locale, ipHash },
      select: { id: true },
    })
    id = row.id
  } catch {
    // A storage failure must not read to the visitor as "your message was bad".
    return { ok: false, messageKey: 'contact.errServer' }
  }

  // The operator reads Arabic; the topic label goes in the admin language.
  // Stored above; a mail failure must not turn a saved message into an error.
  const delivered = await notifyContactMessage({
    name,
    email: replyTo,
    subject: topic ? translate('ar', `contact.topic.${topic}`) : undefined,
    message,
    locale,
  }).catch((error) => {
    console.error('[contact] could not queue the operator email:', error)
    return false
  })
  if (delivered) {
    await db.contactMessage.update({ where: { id }, data: { mailDelivered: true } }).catch(() => {})
  }
  // The sender's own copy, in the page's language (DEV-30).
  await notifyContactReceived({ name, email: replyTo, message, locale })

  return { ok: true }
}
