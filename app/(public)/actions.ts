'use server'

import { z } from 'zod'
import { db } from '@/lib/db'

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
