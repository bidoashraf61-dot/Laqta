'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { generateSecret, otpauthUri, verifyToken, twoFactorRequired } from '@/lib/totp'

/**
 * Two-factor enrolment.
 *
 * The secret is written to the user row at *start*, not at confirm, so the
 * codes the authenticator generates can be verified against it. `twoFactorEnabled`
 * stays false until a code checks out — a half-finished enrolment must never
 * lock someone out of their own account.
 */

export type TwoFactorSetup = { secret: string; uri: string }

export async function beginTwoFactorEnrolment(): Promise<TwoFactorSetup> {
  const sessionUser = await requireUser()
  const secret = generateSecret()

  const user = await db.user.update({
    where: { id: sessionUser.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
    select: { email: true, phone: true },
  })

  return {
    secret,
    uri: otpauthUri({ secret, label: user.email ?? user.phone ?? sessionUser.id }),
  }
}

export async function confirmTwoFactor(
  formData: FormData,
): Promise<{ ok: boolean; messageKey: string }> {
  const sessionUser = await requireUser()
  const token = String(formData.get('token') ?? '')

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { twoFactorSecret: true },
  })
  if (!user?.twoFactorSecret || !verifyToken(user.twoFactorSecret, token)) {
    return { ok: false, messageKey: 'security.invalidToken' }
  }

  await db.user.update({
    where: { id: sessionUser.id },
    data: { twoFactorEnabled: true },
  })
  await recordAudit({
    actorId: sessionUser.id,
    action: 'user.two_factor.enable',
    entity: 'User',
    entityId: sessionUser.id,
  })

  revalidatePath('/[locale]/account/security', 'page')
  return { ok: true, messageKey: 'security.enabledToast' }
}

export async function disableTwoFactor(): Promise<{ ok: boolean; messageKey: string }> {
  const sessionUser = await requireUser()

  // Creators and admins may not opt out — it is a platform requirement, not a
  // preference, and the UI hides the control for them as well.
  if (twoFactorRequired(sessionUser.role)) {
    return { ok: false, messageKey: 'security.twoFactorWhy' }
  }

  await db.user.update({
    where: { id: sessionUser.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })
  await recordAudit({
    actorId: sessionUser.id,
    action: 'user.two_factor.disable',
    entity: 'User',
    entityId: sessionUser.id,
  })

  revalidatePath('/[locale]/account/security', 'page')
  return { ok: true, messageKey: 'security.disabledToast' }
}
