import { countIn, formatMoneyIn, translate } from '@/lib/i18n'
import { BCP47, type Locale } from '@/lib/locale'
import { renderMessage, type Message, type Rendered } from '@/emails/layout'

export type { Rendered } from '@/emails/layout'

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
 * server. A template returns BLOCKS; `emails/layout.ts` turns the same blocks
 * into the HTML part and the text part, so the two never disagree.
 *
 * Copy rules that bind every message here: the catalogue is AI-generated, so no
 * message claims footage was filmed or shot anywhere; refunds are never
 * mentioned (owner decision); no "first" or "largest" claims. `verify:mail`
 * greps the rendered output for all three.
 */

export const TEMPLATES = [
  'order.placed',
  'order.confirmed',
  'sample.claimed',
  'album.approved',
  'album.changes',
  'album.rejected',
  'album.priced',
  'review.queued',
  'contact.message',
  'auth.passwordReset',
  // DEV-30
  'auth.verifyEmail',
  'creator.sale',
  'creator.added',
  'payout.paid',
  'order.paymentFailed',
  'order.paymentPending',
  'order.transferReminder',
  'contact.received',
  'request.received',
  'launch.notice',
  // DEV-57
  'operator.digest',
] as const

export type TemplateName = (typeof TEMPLATES)[number]

type Payload = Record<string, unknown>

const raw = (payload: Payload, key: string) => {
  const value = payload[key]
  return value === undefined || value === null ? '' : String(value)
}

/*
 * First-strong isolate … pop directional isolate, around every value that is
 * interpolated into a sentence. An Arabic album title inside an English
 * sentence — or an order number inside an Arabic one — otherwise drags the
 * surrounding quotes and punctuation into its own direction. The Unicode
 * isolates work in both parts, plain text included, where `<bdi>` cannot.
 * Written as code points so no invisible character sits in the source.
 */
const FSI = String.fromCharCode(0x2068)
const PDI = String.fromCharCode(0x2069)
const iso = (value: string) => (value ? `${FSI}${value}${PDI}` : value)

/** A payload value for prose — isolated. URLs and table cells use `raw`. */
const str = (payload: Payload, key: string) => iso(raw(payload, key))

/**
 * Album titles, from either payload shape.
 *
 * Rows queued before the HTML templates carried one pre-bulleted string; new
 * rows carry an array. Both must render — the outbox may hold either.
 */
const titles = (payload: Payload) => {
  const list = payload.albumTitles
  if (Array.isArray(list)) return list.map(String).filter(Boolean)
  return raw(payload, 'albums')
    .split('\n')
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(Boolean)
}

export function renderTemplate(name: TemplateName, locale: Locale, payload: Payload): Rendered {
  // Bound to THIS message's language. Named `tr` because the gate refuses a
  // bare `t(` anywhere mail is rendered.
  const tr = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
  const money = (key: string) =>
    formatMoneyIn(BCP47[locale], raw(payload, key) || 0, raw(payload, 'currency') || 'USD')

  const message = (
    parts: Pick<Message, 'subject' | 'lead' | 'heading' | 'blocks'> & {
      footer:
        | 'footerBuyer'
        | 'footerCreator'
        | 'footerOperator'
        | 'footerAccount'
        | 'footerContact'
        | 'footerRequest'
        | 'footerWaitlist'
      replyTo?: string
    },
  ): Rendered =>
    renderMessage(locale, {
      ...parts,
      footer: tr(`email.${parts.footer}`),
      brand: tr('brand.name'),
      tagline: tr('brand.tagline'),
    })

  const order = str(payload, 'orderNumber')
  const album = str(payload, 'album')

  switch (name) {
    case 'order.placed': {
      // Only the rows the operator configured; an empty IBAN row helps nobody.
      const bank = [
        { label: tr('email.labelBank'), value: raw(payload, 'bankName') },
        { label: tr('email.labelAccountName'), value: raw(payload, 'bankAccountName') },
        { label: tr('email.labelIban'), value: raw(payload, 'bankIban') },
        { label: tr('email.labelSwift'), value: raw(payload, 'bankSwift') },
      ].filter((row) => row.value)
      const hasBank = Boolean(raw(payload, 'bankIban'))

      return message({
        subject: tr('email.orderPlacedSubject', { order }),
        lead: tr('email.orderPlacedLead'),
        heading: tr('email.orderPlacedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.orderPlacedBody', { name: str(payload, 'name'), order }) },
          {
            kind: 'details',
            rows: [
              { label: tr('email.labelOrder'), value: raw(payload, 'orderNumber') },
              { label: tr('email.labelAmountDue'), value: money('total') },
              { label: tr('email.labelReference'), value: raw(payload, 'reference') },
              ...(hasBank ? bank : []),
            ],
          },
          { kind: 'p', text: tr(hasBank ? 'email.orderPlacedReference' : 'email.orderPlacedNoBank') },
          { kind: 'button', label: tr('email.orderPlacedCta'), url: raw(payload, 'orderUrl') },
          { kind: 'note', text: tr('email.orderPlacedAfter') },
        ],
        footer: 'footerBuyer',
      })
    }

    case 'order.confirmed': {
      const totals =
        payload.total !== undefined
          ? [
              // The promo discount line, when the order had one (DEV-63). The
              // subtotal is already after it.
              ...(raw(payload, 'discountAmount')
                ? [
                    {
                      label: tr('email.labelDiscount', { code: raw(payload, 'promoCode') }),
                      value: `−${money('discountAmount')}`,
                    },
                  ]
                : []),
              // The bundle saving (DEV-62), also already off the subtotal.
              ...(raw(payload, 'bundleDiscountAmount')
                ? [{ label: tr('email.labelBundleDiscount'), value: `−${money('bundleDiscountAmount')}` }]
                : []),
              { label: tr('email.labelSubtotal'), value: money('subtotal') },
              { label: tr('email.labelVat'), value: money('vatAmount') },
              { label: tr('email.labelTotal'), value: money('total') },
            ]
          : []
      return message({
        subject: tr('email.orderConfirmedSubject', { order }),
        lead: tr('email.orderConfirmedLead'),
        heading: tr('email.orderConfirmedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.orderConfirmedBody', { name: str(payload, 'name'), order }) },
          { kind: 'list', items: titles(payload) },
          { kind: 'details', rows: [{ label: tr('email.labelOrder'), value: raw(payload, 'orderNumber') }, ...totals] },
          { kind: 'button', label: tr('email.orderConfirmedCta'), url: raw(payload, 'libraryUrl') },
          {
            kind: 'note',
            // The flag is set only once the PDFs exist and are attached to the
            // row. Without it the message points at the library rather than
            // claim an attachment it may not carry.
            text: tr(payload.certificateAttached ? 'email.certificateAttached' : 'email.certificateInLibrary'),
          },
        ],
        footer: 'footerBuyer',
      })
    }

    /*
     * The free sample was claimed. Not a receipt: nothing was bought, so no
     * totals and no invoice — the order number and the certificate are the
     * record. Says what is in the library, under which licence, and points at
     * it.
     */
    case 'sample.claimed':
      return message({
        subject: tr('email.sampleClaimedSubject', { order }),
        lead: tr('email.sampleClaimedLead'),
        heading: tr('email.sampleClaimedHeading'),
        blocks: [
          {
            kind: 'p',
            text: tr('email.sampleClaimedBody', {
              name: str(payload, 'name'),
              order,
              count: iso(countIn(locale, 'clip', Number(raw(payload, 'clipCount')) || 0)),
            }),
          },
          { kind: 'details', rows: [{ label: tr('email.labelOrder'), value: raw(payload, 'orderNumber') }] },
          { kind: 'button', label: tr('email.sampleClaimedCta'), url: raw(payload, 'libraryUrl') },
          {
            kind: 'note',
            text: tr(payload.certificateAttached ? 'email.certificateAttached' : 'email.certificateInLibrary'),
          },
        ],
        footer: 'footerBuyer',
      })

    case 'album.approved':
      return message({
        subject: tr('email.albumApprovedSubject', { album }),
        lead: tr('email.albumApprovedLead'),
        heading: tr('email.albumApprovedHeading', { album }),
        blocks: [
          { kind: 'p', text: tr('email.albumApprovedBody', { album }) },
          { kind: 'button', label: tr('email.albumApprovedCta'), url: raw(payload, 'albumUrl') },
        ],
        footer: 'footerCreator',
      })

    case 'album.changes':
      return message({
        subject: tr('email.albumChangesSubject', { album }),
        lead: tr('email.albumChangesLead'),
        heading: tr('email.albumChangesHeading', { album }),
        blocks: [
          { kind: 'p', text: tr('email.albumChangesBody', { album }) },
          { kind: 'quote', text: raw(payload, 'notes') },
          // The owner's counter-price, when the feedback carried one (DEV-09b).
          ...(raw(payload, 'proposedPrice')
            ? [
                {
                  kind: 'p' as const,
                  text: tr('email.albumChangesPrice', {
                    price: formatMoneyIn(BCP47[locale], raw(payload, 'proposedPrice'), 'USD'),
                  }),
                },
              ]
            : []),
          { kind: 'button', label: tr('email.albumChangesCta'), url: raw(payload, 'albumUrl') },
        ],
        footer: 'footerCreator',
      })

    case 'album.rejected':
      return message({
        subject: tr('email.albumRejectedSubject', { album }),
        lead: tr('email.albumRejectedLead'),
        heading: tr('email.albumRejectedHeading', { album }),
        blocks: [
          { kind: 'p', text: tr('email.albumRejectedBody', { album }) },
          { kind: 'quote', text: raw(payload, 'notes') },
          { kind: 'p', text: tr('email.albumRejectedReply') },
          { kind: 'button', label: tr('email.albumRejectedCta'), url: raw(payload, 'albumUrl') },
        ],
        footer: 'footerCreator',
      })

    case 'album.priced':
      return message({
        subject: tr('email.albumPricedSubject', { album }),
        lead: tr('email.albumPricedLead'),
        heading: tr('email.albumPricedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.albumPricedBody', { album, price: str(payload, 'price') }) },
          { kind: 'button', label: tr('email.albumPricedCta'), url: raw(payload, 'albumUrl') },
        ],
        footer: 'footerCreator',
      })

    case 'review.queued':
      return message({
        subject: tr('email.reviewQueuedSubject', { album }),
        lead: tr('email.reviewQueuedLead'),
        heading: tr('email.reviewQueuedHeading', { album }),
        blocks: [
          { kind: 'p', text: tr('email.reviewQueuedBody', { album, creator: str(payload, 'creator') }) },
          { kind: 'button', label: tr('email.reviewQueuedCta'), url: raw(payload, 'reviewUrl') },
        ],
        footer: 'footerOperator',
      })

    case 'contact.message': {
      const sender = str(payload, 'name')
      const subject = str(payload, 'subject')
      const senderLocale = raw(payload, 'senderLocale') === 'en' ? 'languageEn' : 'languageAr'
      return message({
        subject: subject
          ? tr('email.contactSubject', { subject })
          : tr('email.contactSubjectFallback', { name: sender }),
        lead: tr('email.contactLead'),
        heading: tr('email.contactHeading', { name: sender }),
        blocks: [
          {
            kind: 'details',
            rows: [
              // The sender's name is prose in either script — not isolated LTR.
              { label: tr('email.labelName'), value: raw(payload, 'name'), ltr: false },
              { label: tr('email.labelEmail'), value: raw(payload, 'email') },
              ...(subject ? [{ label: tr('email.labelSubject'), value: raw(payload, 'subject'), ltr: false }] : []),
              { label: tr('email.labelLanguage'), value: tr(`email.${senderLocale}`), ltr: false },
            ],
          },
          { kind: 'quote', text: raw(payload, 'message') },
          { kind: 'note', text: tr('email.contactReply', { name: sender }) },
        ],
        footer: 'footerOperator',
        // Replying answers the visitor, not the platform's own address.
        replyTo: raw(payload, 'email') || undefined,
      })
    }

    /*
     * «نسيت كلمة المرور؟». The link is the only thing in the message that
     * matters, so it is the one button; the rest says how long it lives and
     * what to do if the reader never asked. The URL is a credential — the
     * drain scrubs it from the outbox row once sent (`SECRET_KEYS`).
     */
    case 'auth.passwordReset': {
      const minutes = iso(new Intl.NumberFormat(BCP47[locale]).format(Number(raw(payload, 'minutes')) || 30))
      return message({
        subject: tr('email.passwordResetSubject'),
        lead: tr('email.passwordResetLead'),
        heading: tr('email.passwordResetHeading'),
        blocks: [
          { kind: 'p', text: tr('email.passwordResetBody') },
          { kind: 'button', label: tr('email.passwordResetCta'), url: raw(payload, 'resetUrl') },
          { kind: 'note', text: tr('email.passwordResetExpiry', { minutes }) },
          { kind: 'p', text: tr('email.passwordResetSignOut') },
          { kind: 'note', text: tr('email.passwordResetIgnore') },
        ],
        footer: 'footerAccount',
      })
    }

    /* ── DEV-30 ─────────────────────────────────────────────────────────── */

    /*
     * «أكّد بريدك الإلكتروني». Was a bare Arabic text message built in
     * lib/mail.ts; now a template, in the reader's language, like the reset.
     * Sent directly (not queued) — see lib/mail.ts#issueEmailVerification.
     */
    case 'auth.verifyEmail': {
      const minutes = iso(new Intl.NumberFormat(BCP47[locale]).format(Number(raw(payload, 'minutes')) || 60))
      return message({
        subject: tr('email.verifyEmailSubject'),
        lead: tr('email.verifyEmailLead'),
        heading: tr('email.verifyEmailHeading'),
        blocks: [
          { kind: 'p', text: tr('email.verifyEmailBody') },
          { kind: 'button', label: tr('email.verifyEmailCta'), url: raw(payload, 'verifyUrl') },
          { kind: 'note', text: tr('email.verifyEmailExpiry', { minutes }) },
          { kind: 'note', text: tr('email.verifyEmailIgnore') },
        ],
        footer: 'footerAccount',
      })
    }

    /* A creator's albums sold — one message per creator per order. */
    case 'creator.sale':
      return message({
        subject: tr('email.creatorSaleSubject'),
        lead: tr('email.creatorSaleLead'),
        heading: tr('email.creatorSaleHeading'),
        blocks: [
          { kind: 'p', text: tr('email.creatorSaleBody') },
          { kind: 'list', items: titles(payload) },
          { kind: 'details', rows: [{ label: tr('email.labelEarnings'), value: money('earnings') }] },
          { kind: 'note', text: tr('email.creatorSaleHold') },
          { kind: 'button', label: tr('email.creatorSaleCta'), url: raw(payload, 'earningsUrl') },
        ],
        footer: 'footerCreator',
      })

    case 'creator.added':
      return message({
        subject: tr('email.creatorAddedSubject'),
        lead: tr('email.creatorAddedLead'),
        heading: tr('email.creatorAddedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.creatorAddedBody') },
          { kind: 'button', label: tr('email.creatorAddedCta'), url: raw(payload, 'studioUrl') },
          { kind: 'note', text: tr('email.creatorAddedSignIn') },
        ],
        footer: 'footerCreator',
      })

    case 'payout.paid': {
      const amount = iso(money('amount'))
      const methodKey = { iban: 'methodIban', payoneer: 'methodPayoneer', wise: 'methodWise' }[raw(payload, 'method')]
      const method = methodKey ? tr(`email.${methodKey}`) : raw(payload, 'method')
      return message({
        subject: tr('email.payoutPaidSubject', { amount }),
        lead: tr('email.payoutPaidLead'),
        heading: tr('email.payoutPaidHeading'),
        blocks: [
          { kind: 'p', text: tr('email.payoutPaidBody', { amount, method: iso(method) }) },
          {
            kind: 'details',
            rows: [
              { label: tr('email.labelAmount'), value: money('amount') },
              { label: tr('email.labelMethod'), value: method, ltr: false },
              ...(raw(payload, 'reference') ? [{ label: tr('email.labelReference'), value: raw(payload, 'reference') }] : []),
            ],
          },
          { kind: 'button', label: tr('email.payoutPaidCta'), url: raw(payload, 'payoutsUrl') },
        ],
        footer: 'footerCreator',
      })
    }

    case 'order.paymentFailed':
      return message({
        subject: tr('email.paymentFailedSubject', { order }),
        lead: tr('email.paymentFailedLead'),
        heading: tr('email.paymentFailedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.paymentFailedBody', { order }) },
          { kind: 'button', label: tr('email.paymentFailedCta'), url: raw(payload, 'cartUrl') },
        ],
        footer: 'footerBuyer',
      })

    case 'order.paymentPending':
      return message({
        subject: tr('email.paymentPendingSubject', { order }),
        lead: tr('email.paymentPendingLead'),
        heading: tr('email.paymentPendingHeading'),
        blocks: [
          { kind: 'p', text: tr('email.paymentPendingBody', { order }) },
          { kind: 'button', label: tr('email.orderPlacedCta'), url: raw(payload, 'orderUrl') },
        ],
        footer: 'footerBuyer',
      })

    /* Sent once, by the daily job, for a bank-transfer order still unpaid. */
    case 'order.transferReminder': {
      const bank = [
        { label: tr('email.labelBank'), value: raw(payload, 'bankName') },
        { label: tr('email.labelAccountName'), value: raw(payload, 'bankAccountName') },
        { label: tr('email.labelIban'), value: raw(payload, 'bankIban') },
        { label: tr('email.labelSwift'), value: raw(payload, 'bankSwift') },
      ].filter((row) => row.value)
      return message({
        subject: tr('email.transferReminderSubject', { order }),
        lead: tr('email.transferReminderLead'),
        heading: tr('email.transferReminderHeading'),
        blocks: [
          { kind: 'p', text: tr('email.transferReminderBody', { name: str(payload, 'name'), order }) },
          {
            kind: 'details',
            rows: [
              { label: tr('email.labelOrder'), value: raw(payload, 'orderNumber') },
              { label: tr('email.labelAmountDue'), value: money('total') },
              { label: tr('email.labelReference'), value: raw(payload, 'reference') },
              ...bank,
            ],
          },
          { kind: 'button', label: tr('email.orderPlacedCta'), url: raw(payload, 'orderUrl') },
        ],
        footer: 'footerBuyer',
      })
    }

    /* The visitor's copy of what they sent through /contact. */
    case 'contact.received':
      return message({
        subject: tr('email.contactReceivedSubject'),
        lead: tr('email.contactReceivedLead'),
        heading: tr('email.contactReceivedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.contactReceivedBody', { name: str(payload, 'name') }) },
          { kind: 'quote', text: raw(payload, 'message') },
          { kind: 'note', text: tr('email.contactReceivedNote') },
        ],
        footer: 'footerContact',
      })

    case 'request.received':
      return message({
        subject: tr('email.requestReceivedSubject'),
        lead: tr('email.requestReceivedLead'),
        heading: tr('email.requestReceivedHeading'),
        blocks: [
          { kind: 'p', text: tr('email.requestReceivedBody') },
          { kind: 'quote', text: raw(payload, 'brief') },
        ],
        footer: 'footerRequest',
      })

    case 'launch.notice':
      return message({
        subject: tr('email.launchSubject'),
        lead: tr('email.launchLead'),
        heading: tr('email.launchHeading'),
        blocks: [
          { kind: 'p', text: tr('email.launchBody') },
          { kind: 'button', label: tr('email.launchCta'), url: raw(payload, 'albumsUrl') },
          { kind: 'note', text: tr('email.launchSample') },
          ...(raw(payload, 'unsubscribeUrl')
            ? [{ kind: 'note' as const, text: tr('email.launchUnsubscribe', { url: raw(payload, 'unsubscribeUrl') }) }]
            : []),
        ],
        footer: 'footerWaitlist',
      })

    /* ── DEV-57: the operator's morning summary ─────────────────────────── */
    case 'operator.digest': {
      const n = (key: string) => Number(raw(payload, key)) || 0
      const count = (key: string) => new Intl.NumberFormat(`${BCP47[locale]}-u-nu-latn`).format(n(key))
      const rows = [
        { label: tr('email.digestReview'), value: count('reviewQueue') },
        ...(n('reviewOverdue') ? [{ label: tr('email.digestReviewLate'), value: count('reviewOverdue') }] : []),
        { label: tr('email.digestTransfers'), value: count('unsettledTransfers') },
        ...(raw(payload, 'oldestTransfer') ? [{ label: tr('email.digestTransfersOldest'), value: raw(payload, 'oldestTransfer') }] : []),
        { label: tr('email.digestPayouts'), value: count('payoutRequests') },
        { label: tr('email.digestMessages'), value: count('openMessages') },
        { label: tr('email.digestRequests'), value: count('newRequests') },
        { label: tr('email.digestMail'), value: count('failedMail') },
      ]
      const nothing = ['reviewQueue', 'unsettledTransfers', 'payoutRequests', 'openMessages', 'newRequests', 'failedMail'].every(
        (key) => n(key) === 0,
      )
      return message({
        subject: tr('email.digestSubject', { date: str(payload, 'date') }),
        lead: tr('email.digestLead'),
        heading: tr('email.digestHeading'),
        blocks: [
          { kind: 'p', text: nothing ? tr('email.digestAllClear') : tr('email.digestBody', { time: str(payload, 'time') }) },
          { kind: 'details', rows },
          { kind: 'button', label: tr('email.digestCta'), url: raw(payload, 'adminUrl') },
        ],
        footer: 'footerOperator',
      })
    }

    default:
      /*
       * Reachable despite the exhaustive switch above: `drain` casts a
       * database string to TemplateName, which defeats the type check. A
       * template renamed in code while rows still name the old one — every
       * deploy with a non-empty outbox — would otherwise return undefined and
       * throw a TypeError on `.subject`, five times, with no clue why.
       */
      throw new Error(`Unknown mail template: ${String(name)}`)
  }
}
