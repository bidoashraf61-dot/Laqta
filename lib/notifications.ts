import { sendMail } from '@/lib/mail'
import { siteUrl } from '@/lib/site'
import { DEFAULT_LOCALE, type Locale } from '@/lib/locale'

/**
 * Operator notifications.
 *
 * ── Placeholder on this branch ──────────────────────────────────────────────
 * `lib/notifications.ts` is being written in full on another branch. This file
 * exports only what /contact needs, with the agreed signature, as a thin
 * wrapper over `sendMail`; the two are reconciled on merge.
 *
 * Returns whether the mail actually left. It never throws: the contact message
 * is already stored when this runs, and a mail failure must not turn a saved
 * message into an error on the visitor's screen.
 */
export async function notifyContactMessage({
  name,
  email,
  subject,
  message,
  locale,
}: {
  name: string
  email: string
  subject?: string | null
  message: string
  locale: Locale
}): Promise<boolean> {
  const operator = process.env.OPERATOR_EMAIL
  if (!operator) {
    console.info('[notifications] OPERATOR_EMAIL is not set — contact message stored, not mailed')
    return false
  }

  // Written to the operator, so in the admin area's language (Arabic) — the
  // visitor's language is stated so the reply can match it.
  const lines = [
    `الاسم: ${name}`,
    `البريد: ${email}`,
    subject ? `الموضوع: ${subject}` : null,
    `اللغة: ${locale === 'en' ? 'English' : 'العربية'}`,
    '',
    message,
    '',
    siteUrl('/admin/messages', DEFAULT_LOCALE),
  ].filter((line): line is string => line !== null)

  try {
    return await sendMail(operator, `رسالة جديدة من صفحة التواصل — ${name}`, lines.join('\n'))
  } catch (error) {
    console.error('[notifications] contact message mail failed', error)
    return false
  }
}
