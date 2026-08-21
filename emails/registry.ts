import { translate } from '@/lib/i18n'
import type { Locale } from '@/lib/locale'

/**
 * The message catalogue.
 *
 * ── Two rules, both learned the hard way ────────────────────────────────────
 * 1. **Never the ambient `t()`.** Every template takes an explicit locale and
 *    calls `translate(locale, key)` through a local `tr` binding. The sender
 *    runs outside a React render, where `t()`'s `cache()`-backed store has no
 *    scope and silently returns Arabic for every recipient.
 *    `verify:action-locale` covers this directory and refuses a bare `t(`.
 * 2. **No sentence is written here.** Copy lives in `messages/*.json` under
 *    `email.*`, so the editorial passes and `verify:arabic` reach it, and so an
 *    edit reaches mail that is already queued but not yet sent.
 *
 * A template is a pure function of (locale, payload). No database, no clock,
 * no request — which is what lets a gate render every one of them without a
 * server.
 */

export const TEMPLATES = [
  'order.confirmed',
  'order.settled',
  'album.approved',
  'album.changes',
  'album.priced',
  'review.queued',
] as const

export type TemplateName = (typeof TEMPLATES)[number]

export type Rendered = { subject: string; body: string }

type Payload = Record<string, unknown>

const str = (payload: Payload, key: string) => {
  const value = payload[key]
  return value === undefined || value === null ? '' : String(value)
}

/**
 * Plain text, deliberately.
 *
 * An HTML mail needs a table-based layout, inline styles, a text alternative
 * and a rendering matrix across a dozen clients — and none of that makes a
 * download link work better. These messages are short and functional. HTML can
 * come later without touching the outbox, because the body is just a string.
 */
export function renderTemplate(name: TemplateName, locale: Locale, payload: Payload): Rendered {
  // Bound to THIS message's language. Named `tr` because the gate refuses a
  // bare `t(` anywhere mail is rendered.
  const tr = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
  const signOff = `\n\n— ${tr('brand.name')}\n${tr('brand.tagline')}`

  switch (name) {
    case 'order.confirmed':
      return {
        subject: tr('email.orderConfirmedSubject', { order: str(payload, 'orderNumber') }),
        body:
          tr('email.orderConfirmedBody', {
            name: str(payload, 'name'),
            order: str(payload, 'orderNumber'),
            albums: str(payload, 'albums'),
          }) +
          `\n\n${str(payload, 'libraryUrl')}` +
          `\n\n${tr('email.certificateAttached')}` +
          signOff,
      }

    case 'order.settled':
      return {
        subject: tr('email.orderSettledSubject', { order: str(payload, 'orderNumber') }),
        body:
          tr('email.orderSettledBody', { order: str(payload, 'orderNumber') }) +
          `\n\n${str(payload, 'libraryUrl')}` +
          signOff,
      }

    case 'album.approved':
      return {
        subject: tr('email.albumApprovedSubject', { album: str(payload, 'album') }),
        body:
          tr('email.albumApprovedBody', { album: str(payload, 'album') }) +
          `\n\n${str(payload, 'albumUrl')}` +
          signOff,
      }

    case 'album.changes':
      return {
        subject: tr('email.albumChangesSubject', { album: str(payload, 'album') }),
        body:
          tr('email.albumChangesBody', { album: str(payload, 'album') }) +
          `\n\n${str(payload, 'notes')}` +
          `\n\n${str(payload, 'albumUrl')}` +
          signOff,
      }

    case 'album.priced':
      return {
        subject: tr('email.albumPricedSubject', { album: str(payload, 'album') }),
        body:
          tr('email.albumPricedBody', {
            album: str(payload, 'album'),
            price: str(payload, 'price'),
          }) +
          `\n\n${str(payload, 'albumUrl')}` +
          signOff,
      }

    case 'review.queued':
      return {
        subject: tr('email.reviewQueuedSubject', { album: str(payload, 'album') }),
        body:
          tr('email.reviewQueuedBody', {
            album: str(payload, 'album'),
            creator: str(payload, 'creator'),
          }) +
          `\n\n${str(payload, 'reviewUrl')}` +
          signOff,
      }
  }
}
