'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { claimSample } from '@/lib/orders'
import { currentLocale, localePath } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

/**
 * Claim the free sample, then land in the library.
 *
 * `claimSample` is idempotent, so a double submit or a claim after an earlier
 * one simply opens the same library entry. Documents (the certificate PDF)
 * render after the redirect — the files are downloadable immediately.
 */
export async function claimSampleAction() {
  await requestLocale()
  const locale = currentLocale()
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect(localePath(locale, `/sign-in?callbackUrl=${encodeURIComponent(localePath(locale, '/sample'))}`))

  const result = await claimSample(userId, { deferDocuments: true })
  if (!result.ok) redirect(localePath(locale, '/sample?claim=unavailable'))
  redirect(localePath(locale, `/account/library/${result.entitlementId}`))
}
