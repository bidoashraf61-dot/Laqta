'use server'

import { redirect } from 'next/navigation'
import { unsubscribeByToken } from '@/lib/waitlist'
import { localePath } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

/** Leave the waitlist (DEV-45). A POST — link scanners that prefetch a GET never unsubscribe anyone. */
export async function unsubscribe(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  const locale = await requestLocale()
  const ok = await unsubscribeByToken(token)
  redirect(localePath(locale, `/waitlist/unsubscribe?${ok ? 'done=1' : 'invalid=1'}`))
}
