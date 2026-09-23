import type { Prisma, PrismaClient } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { db } from '@/lib/db'
import { sendMail, isMailConfigured } from '@/lib/mail'
import { documentPath } from '@/lib/storage'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locale'
import { renderTemplate, type TemplateName } from '@/emails/registry'

/**
 * The transactional outbox.
 *
 * ── Why a queue and not a send ──────────────────────────────────────────────
 * A message is never sent from inside the transaction that creates the thing
 * it describes, and a mail failure never rolls that thing back. Someone who
 * paid owns what they bought whether or not a mail server was reachable.
 *
 * `enqueue` therefore takes the transaction client, so the row lands in the
 * SAME transaction as the order or the review decision — "it happened" and
 * "the email is owed" become one atomic fact. `drain` sends afterwards.
 *
 * The third thing this buys, and the reason it matters here: with one person
 * operating the platform, "which emails did not go out?" has to be a question
 * the dashboard can answer. A direct send that throws into a log is invisible.
 */

/** Transaction client or the base client — either can write a row. */
type Client = PrismaClient | Prisma.TransactionClient

/** Exported so the admin panel counts failures by the same rule drain uses. */
export const MAX_ATTEMPTS = 5

export type EnqueueInput = {
  template: TemplateName
  toEmail: string
  locale: Locale | string | null | undefined
  payload: Record<string, unknown>
  /** Storage keys, resolved to files at send time. */
  attachments?: string[]
}

/**
 * Queue a message.
 *
 * The locale is FROZEN here, not resolved when sending. The sender runs
 * outside any request and has no locale header, and `t()` reads a store built
 * on React's `cache()` which only memoises inside a render — so resolving
 * language at send time would answer every recipient in Arabic. Same defect
 * `verify:action-locale` exists to catch, one layer further out.
 */
export async function enqueue(client: Client, input: EnqueueInput) {
  return client.mailOutbox.create({
    data: {
      template: input.template,
      toEmail: input.toEmail,
      locale: isLocale(input.locale ?? undefined) ? (input.locale as Locale) : DEFAULT_LOCALE,
      payload: input.payload as Prisma.InputJsonValue,
      attachments: input.attachments ?? [],
    },
  })
}

/**
 * Send what is waiting.
 *
 * Claims each row before sending, so two concurrent drains cannot both send
 * the same message. Returns a small summary the admin screen can show.
 */
export async function drain(limit = 25) {
  /*
   * Nothing can be sent without a provider, and trying anyway is not free.
   *
   * The no-provider branch below deliberately does NOT consume an attempt, so
   * those rows stay permanently eligible and permanently first in line. Once
   * more than `limit` accumulate, every drain would re-read and re-render the
   * same oldest batch forever while newer rows are never touched. Returning
   * early keeps the queue intact and honest until a provider exists.
   */
  if (!isMailConfigured()) {
    const waiting = await db.mailOutbox.count({ where: { sentAt: null, failedAt: null } })
    return { attempted: 0, sent: 0, failed: 0, skipped: waiting }
  }

  const pending = await db.mailOutbox.findMany({
    where: { sentAt: null, failedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let sent = 0
  let failed = 0

  for (const row of pending) {
    // Claim it. If another drain already incremented past us, skip — the
    // `attempts` guard makes the update a compare-and-set.
    const claimed = await db.mailOutbox.updateMany({
      where: { id: row.id, attempts: row.attempts, sentAt: null },
      data: { attempts: row.attempts + 1 },
    })
    if (claimed.count === 0) continue

    try {
      const locale = isLocale(row.locale) ? row.locale : DEFAULT_LOCALE
      const rendered = renderTemplate(
        row.template as TemplateName,
        locale,
        row.payload as Record<string, unknown>,
      )

      const attachments = await loadAttachments(row.attachments)
      const delivered = await sendMail(row.toEmail, rendered.subject, rendered.text, attachments, {
        html: rendered.html,
        replyTo: rendered.replyTo,
        // A retry of this row is the same message: the provider drops the
        // duplicate if an earlier attempt was accepted but timed out here.
        idempotencyKey: `outbox:${row.id}`,
      })

      if (delivered) {
        await db.mailOutbox.update({ where: { id: row.id }, data: { sentAt: new Date(), lastError: null } })
        sent++
      } else {
        // Not an error: no provider is configured and the driver said so. The
        // row stays pending so it goes out the moment one is.
        await db.mailOutbox.update({
          where: { id: row.id },
          data: { attempts: row.attempts, lastError: 'no mail provider configured' },
        })
      }
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : String(error)
      await db.mailOutbox.update({
        where: { id: row.id },
        data: {
          lastError: message.slice(0, 500),
          // A bounce is not transient. Park it rather than burning five
          // attempts on an address that will never accept mail.
          failedAt: isPermanent(message) ? new Date() : undefined,
        },
      })
    }
  }

  return { attempted: pending.length, sent, failed, skipped: 0 }
}

/**
 * Drain without making the caller wait.
 *
 * Called after the request that queued something. Deliberately swallows its
 * own failure: the row is already safe in the table, and a drain that throws
 * must not surface as an error on a page that succeeded.
 */
export function drainSoon() {
  void drain().catch((error) => console.error('[outbox] drain failed:', error))
}

function isPermanent(message: string) {
  return /invalid recipient|invalid `to`|no such user|mailbox unavailable|550|blocked|suppress/i.test(message)
}

async function loadAttachments(keys: string[]) {
  const files = await Promise.all(
    keys.map(async (key) => {
      try {
        return {
          filename: key.split('/').pop() ?? 'document.pdf',
          content: await readFile(documentPath(key)),
        }
      } catch {
        // A missing document must never withhold the message. The body always
        // carries a link as well, so the reader can still reach it.
        console.warn(`[outbox] attachment missing, sending without it: ${key}`)
        return null
      }
    }),
  )
  return files.filter((file): file is NonNullable<typeof file> => file !== null)
}
