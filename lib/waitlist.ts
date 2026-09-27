import { db } from '@/lib/db'
import { sendLaunchNotice } from '@/lib/jobs'
import { siteUrl } from '@/lib/site'

/**
 * The launch waiting list (DEV-45).
 *
 * One row per address. Joining again after an unsubscribe re-subscribes —
 * that is an explicit new request from the same person — but an import or a
 * sync never does. The consent wording is versioned: `consentText` records
 * which line the person saw.
 */

export const WAITLIST_CONSENT_VERSION = 'waitlist-consent-v1'
export const WAITLIST_SOURCES = ['landing', 'sample', 'footer', 'albums', 'import'] as const
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number]

export function waitlistSource(value: unknown): WaitlistSource {
  return (WAITLIST_SOURCES as readonly string[]).includes(String(value)) ? (value as WaitlistSource) : 'landing'
}

export async function joinWaitlist(input: { email: string; locale: string; source: WaitlistSource; ipHash?: string | null }) {
  const email = input.email.trim().toLowerCase()
  const locale = input.locale === 'en' ? 'en' : 'ar'
  await db.waitlistEntry.upsert({
    where: { email },
    create: { email, locale, source: input.source, consentText: WAITLIST_CONSENT_VERSION, ipHash: input.ipHash ?? null },
    update: {
      // Signing up again is a fresh consent — and brings back someone who had
      // left. Language and source follow the latest request.
      locale,
      consentAt: new Date(),
      consentText: WAITLIST_CONSENT_VERSION,
      unsubscribedAt: null,
    },
  })
}

export function unsubscribeUrl(token: string, locale: string) {
  return siteUrl(`/waitlist/unsubscribe?token=${encodeURIComponent(token)}`, locale)
}

/** Leave the list. Returns the entry's language, or null for an unknown token. */
export async function unsubscribeByToken(token: string) {
  if (!token || token.length > 64) return null
  const entry = await db.waitlistEntry.findUnique({ where: { unsubscribeToken: token }, select: { id: true, locale: true, unsubscribedAt: true } })
  if (!entry) return null
  if (!entry.unsubscribedAt) {
    await db.waitlistEntry.update({ where: { id: entry.id }, data: { unsubscribedAt: new Date() } })
  }
  return entry.locale
}

/** The launch notice to everyone still on the list who has not had it. */
export async function notifyWaitlistOfLaunch() {
  const entries = await db.waitlistEntry.findMany({
    where: { unsubscribedAt: null, launchNotifiedAt: null },
    select: { id: true, email: true, locale: true, unsubscribeToken: true },
    take: 5000,
  })
  const queued = await sendLaunchNotice(
    entries.map((entry) => ({ email: entry.email, locale: entry.locale, unsubscribeUrl: unsubscribeUrl(entry.unsubscribeToken, entry.locale) })),
  )
  await db.waitlistEntry.updateMany({ where: { id: { in: entries.map((entry) => entry.id) } }, data: { launchNotifiedAt: new Date() } })
  return { queued, total: entries.length }
}

/** CSV of the list — every row, unsubscribed ones marked, for the owner's records. */
export async function waitlistCsv() {
  const rows = await db.waitlistEntry.findMany({ orderBy: { createdAt: 'asc' } })
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  const lines = [
    'email,language,source,signed_up,consent,unsubscribed,launch_notified',
    ...rows.map((row) =>
      [
        row.email,
        row.locale,
        row.source,
        row.createdAt.toISOString(),
        row.consentText,
        row.unsubscribedAt?.toISOString() ?? '',
        row.launchNotifiedAt?.toISOString() ?? '',
      ]
        .map(cell)
        .join(','),
    ),
  ]
  return lines.join('\n') + '\n'
}

export function resendAudienceConfigured() {
  return Boolean(process.env.RESEND_AUDIENCE_ID && process.env.MAIL_API_KEY)
}

/**
 * Push the list to a Resend audience (Resend's contacts API), so a broadcast
 * can go from Resend too. Dormant until `RESEND_AUDIENCE_ID` and `MAIL_API_KEY`
 * are set. Unsubscribes are pushed as `unsubscribed: true`, never deleted.
 */
export async function syncWaitlistToResend(fetcher: typeof fetch = fetch) {
  if (!resendAudienceConfigured()) return { ok: false as const, reason: 'unconfigured' as const }
  const audience = process.env.RESEND_AUDIENCE_ID!
  const key = process.env.MAIL_API_KEY!
  const rows = await db.waitlistEntry.findMany({
    // New, re-consented or unsubscribed since the last push.
    where: {
      OR: [
        { syncedAt: null },
        { consentAt: { gt: db.waitlistEntry.fields.syncedAt } },
        { unsubscribedAt: { gt: db.waitlistEntry.fields.syncedAt } },
      ],
    },
    select: { id: true, email: true, unsubscribedAt: true },
    take: 1000,
  })
  let synced = 0
  for (const row of rows) {
    const response = await fetcher(`https://api.resend.com/audiences/${encodeURIComponent(audience)}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: row.email, unsubscribed: Boolean(row.unsubscribedAt) }),
    }).catch(() => null)
    if (!response?.ok) continue
    await db.waitlistEntry.update({ where: { id: row.id }, data: { syncedAt: new Date() } })
    synced += 1
  }
  return { ok: true as const, synced, attempted: rows.length }
}
