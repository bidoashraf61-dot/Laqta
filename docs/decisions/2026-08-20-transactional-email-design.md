# Spec A — Transactional email

**Status** approved 2026-08-20, not built · **Order** first of three (A → C → B)

## Purpose

Nothing on this platform can tell anyone anything. A buyer pays and hears
silence. A creator's album goes live and nobody tells them. An album lands in
the review queue and the operator finds out by refreshing a dashboard.

This spec builds the rail that carries a message, the documents worth
attaching, and the first six messages.

## Why this is first

Spec B cannot exist without it — "your album is priced, please accept" is a
message, and the album sits in limbo until it arrives. And a store that takes
money in silence is worse than a store that has not opened.

## Architecture

### The driver boundary

`lib/mail.ts` already has the shape: a `sendMail(to, subject, body)` that logs
and returns `delivered: false` when `MAIL_PROVIDER` and `MAIL_API_KEY` are
unset. It mirrors `lib/payments.ts` and `lib/storage.ts` — an interface plus an
honest local driver, so the absence of a provider is visible rather than faked.

**No provider is chosen yet.** That is a deliberate deferral, recorded in
memory as `mail-provider-not-chosen`. Adding one is an adapter and two
environment variables; nothing in this spec assumes a particular vendor.

`sendMail` grows an optional attachments parameter. Nothing else about the
signature changes.

### The outbox — why sending is not inline

A message must never be sent from inside the transaction that creates the
order, and a failure to send must never roll the order back. Someone who paid
owns what they bought whether or not an email server was reachable.

So: a `MailOutbox` table. Rows are written **in the same transaction** as the
thing they describe, which makes "the order exists" and "the email is owed"
atomic. A sender then drains the table.

```
model MailOutbox {
  id          String    @id @default(cuid())
  template    String                    // 'order.confirmed', 'album.approved', …
  toEmail     String
  locale      String                    // frozen at write time — see below
  payload     Json                      // ids and values the template needs
  attempts    Int       @default(0)
  lastError   String?
  sentAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([sentAt, createdAt])
}
```

This buys three things a direct call cannot: a purchase never fails because of
mail, a failed send is retryable, and the operator can *see* what did not go
out — which matters when one person runs everything.

**Draining.** No queue infrastructure exists and none is introduced. The sender
runs on demand: after the request that wrote the row (best effort,
non-blocking), and from an admin control that flushes anything still pending.
A cron can be added later without changing the table.

**Retry.** Up to 5 attempts. After that the row stays unsent with `lastError`
populated and surfaces in the admin mail panel. Never retry a permanent
rejection — a bounced address is not a transient failure.

### Locale is frozen at write time

The recipient's language is resolved when the row is written and stored on the
row. It is not resolved at send time, because the sender has no request and
therefore no locale header.

**This is the same defect that `verify:action-locale` exists to catch.** `t()`
reads a store built on React's `cache()`, which only memoises inside a render.
A background sender is not a render, so `t()` would silently return Arabic for
every recipient. Templates must call `translate(locale, key)` with the locale
from the row. The gate is extended to cover the mail templates directory.

### Documents

Two PDFs are needed eventually: the licence certificate (this spec) and the tax
invoice (deferred, pending the accountant — see
`docs/business/tax-questions-for-accountant-ar.md`). They share a renderer, so building
one now makes the other mostly done.

**Rendered with Playwright, not a PDF library.** This is the load-bearing
decision in the section. `pdfkit`, `react-pdf` and their peers handle Arabic
badly or not at all: they need explicit bidi reordering and glyph shaping, and
they routinely emit Arabic as disconnected letters in reverse order. Chrome
already shapes Arabic correctly, already handles RTL layout, and Playwright is
already a dependency because the browser gates use it. A document is therefore
an ordinary bilingual React component rendered to HTML and printed to PDF.

Output is written through `lib/storage.ts`, so it follows whatever driver is
configured — locally today, object storage after deployment.

**The certificate itself.** `LicenceCertificate` already exists and
`lib/orders.ts:163` already creates one per order item with a unique
`certificateNumber`. Only `pdfKey` is empty. This spec fills it.

The certificate carries: certificate number, the buyer's legal name, the album
and its clips as sold, the purchase date, the licence version, and the grant in
both languages. It is the document a buyer uploads when disputing a copyright
claim — the realistic protection for a footage marketplace, as distinct from
indemnification (deferred, needs counsel) and Content ID whitelisting
(deliberately not built).

## The messages

Six, each rendered in the recipient's own language.

| Template | Trigger | To | Carries |
|---|---|---|---|
| `order.confirmed` | Order reaches `paid` | Buyer | What was bought, download links, **certificate PDF attached** |
| `order.settled` | Operator settles a bank transfer | Buyer | Payment confirmed, downloads now open |
| `album.approved` | `decideReview` approves | Creator | Album is live, link to it |
| `album.changes` | `decideReview` requests changes | Creator | The reviewer's specific notes |
| `album.priced` | Spec B sets a price | Creator | The price, and the link to accept it |
| `review.queued` | Album submitted for review | **Operator** | What arrived and how long it has been waiting |

`album.priced` is written now and only fires once Spec B lands. It is included
here so B does not have to reopen this spec.

**Templates the later specs add to this rail.** Written when their spec is
built, not now, but named here so the rail is designed for all of them and no
later spec has to reopen this one:

| Template | From | To | Trigger |
|---|---|---|---|
| `album.repriced` | Spec C | Creator | A price-band edit repriced their live album |
| `payout.paid` | Spec C | Creator | A payout run is marked paid |
| `album.negotiation` | Spec B | Either party | The other side replied on price |

Nothing about the outbox changes to accommodate them — a template is a row
value, not a schema change. That is the point of the table.

The existing email verification (`issueEmailVerification`) moves onto this rail
rather than calling `sendMail` directly, so verification mail is retryable and
visible like everything else.

**Templates** live in `emails/`, are ordinary React components, and take
`(locale, payload)`. Copy goes in `messages/*.json` under an `email.*` section
like every other string in the product — never inline, so `verify:arabic` and
the editorial passes cover it.

## Data flow

```
purchase committed ──┐
                     ├─ MailOutbox row (same transaction)
LicenceCertificate ──┘
        │
        └─ render certificate PDF ─→ storage ─→ pdfKey

        drain (post-request, best effort)
              │
              ├─ translate(locale, …) → subject + body
              ├─ attach certificate by pdfKey
              └─ sendMail → sentAt, or attempts++ and lastError
```

## States and failure

- **No provider configured** — every row stays pending, `lastError` says so
  plainly, and `/admin/settings` shows mail as not configured beside storage.
  Nothing pretends to have sent.
- **Send fails transiently** — retried up to 5 times, then parked and surfaced.
- **Address bounces permanently** — parked immediately, not retried.
- **PDF generation fails** — the message still sends **without** the
  attachment, carrying a link instead. A missing document must not withhold the
  download links a buyer just paid for.
- **Buyer has no email** — impossible; email is the login identity.
- **Duplicate sends** — the drain claims a row before sending, so two
  concurrent drains cannot both send it.

## Invariants

1. **A message is never sent inside a transaction**, and a mail failure never
   fails the operation that owed the message.
2. **Locale is frozen on the row.** Templates use `translate(locale, key)` and
   never bare `t()` — a sender has no render scope, so `t()` would answer in
   Arabic for everyone.
3. **Copy lives in `messages/*.json`.** No sentence is written inline in a
   template.
4. **The absence of a provider is visible**, never simulated.
5. **Certificate numbers are already issued and must not be regenerated** —
   this spec renders the document for an existing number, it does not mint one.

## Verified by

- `verify:action-locale` extended to cover `emails/` and the sender.
- A new `verify:mail` — asserts every template renders in both languages, that
  no template calls `t()`, that a failed send never marks `sentAt`, and that a
  PDF failure still sends the message.
- `verify:arabic` picks up the new `email.*` copy automatically.
- Certificate PDF checked by eye once, in Arabic, for correct glyph shaping and
  RTL layout — the failure mode this renderer was chosen to avoid.

## Deliberately not in scope

Marketing email, newsletters, and the waitlist blast (the waitlist *reader* is
Spec C). Content ID channel whitelisting — it solves a music problem this
catalogue does not have, and the certificate covers the realistic case.
The tax invoice PDF, which waits on the accountant.

## Open

- **No mail provider chosen.** The single blocking decision. Everything else
  here is buildable today.
