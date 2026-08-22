# Transactional email — cross-cutting

**Applies to every surface that owes someone a message.** Built from
`docs/superpowers/specs/2026-08-20-transactional-email-design.md`.

## Purpose
Before this, the platform sent nothing at all. A buyer paid and heard silence, a
creator's album went live without being told, and an album entered the review
queue with no way for the operator to know but to refresh a dashboard.

## The machinery

| Piece | File | Notes |
|---|---|---|
| Driver + verification tokens | `lib/mail.ts` | Honest local driver; `mailConfigured` |
| Outbox (queue, drain, retry) | `lib/outbox.ts` | `enqueue(tx, …)`, `drain()`, `drainSoon()` |
| Templates | `emails/registry.ts` | Pure `(locale, payload)` functions |
| Copy | `messages/*.json` → `email.*` | 14 keys, both languages |
| PDF renderer | `lib/documents.ts` | Chrome via Playwright |
| Licence certificate | `lib/certificate.ts` | Rendered per order item |
| Absolute URLs | `lib/site.ts` | `SITE_ORIGIN`; a sender has no request |

## Why an outbox and not a send

A message is never sent from inside the transaction that creates the thing it
describes, and a mail failure never rolls that thing back — someone who paid
owns what they bought whether or not a mail server was reachable. `enqueue`
takes the transaction client, so "it happened" and "an email is owed" commit
together. `drain` sends afterwards.

The third benefit is the one that matters for a solo operator: a failed send is
*visible*. `/admin/settings` shows pending, sent and failed counts.

## Why Chrome renders the PDF

`pdfkit`, `react-pdf` and their peers do not shape Arabic — without explicit
bidi reordering and glyph substitution they emit disconnected letters in reverse
order. Chrome does both, lays out RTL, and renders the site's own fonts.
Playwright is already a dependency for the browser gates.

Certificates for a multi-item order render **one at a time**, never through
`Promise.all` — each render launches its own Chrome, so mapping concurrently
would start one browser per album at the same instant. Concurrent callers for
the *same* order item share a single in-flight render rather than starting a
second.

A browser is launched **per render and closed**, not held open. A live browser
keeps handles on the event loop, so `process.exit` never fires and any
short-lived process hangs — `verify:entitlement` settles an order, renders a
certificate, and simply never returned.

## The messages

| Template | Trigger | To |
|---|---|---|
| `order.confirmed` | `settleOrder` | Buyer — with the certificate attached |
| `order.settled` | Bank transfer settled | Buyer |
| `album.approved` | `decideReview` approve | Creator |
| `album.changes` | `decideReview` changes | Creator |
| `album.priced` | Spec B (written, not yet fired) | Creator |
| `review.queued` | `submitForReview` | Operator, via `OPERATOR_EMAIL` |

`reject` is deliberately silent — a delisting is a conversation, not a template.

## Invariants

1. **Locale is frozen on the outbox row.** A sender has no render scope, so
   `t()` would answer every recipient in Arabic. Templates use
   `translate(locale, key)` through a local `tr` binding.
2. **No sentence is written in a template.** Copy lives in `messages/*.json`.
3. **A mail failure never fails the operation that owed the message.**
4. **A missing attachment never withholds the message**, which always carries a
   link as well.
5. **The absence of a provider is visible, never simulated.**

## States

- **No provider configured** — rows stay pending with `lastError` saying so;
  `/admin/settings` shows mail as inactive.
- **Transient failure** — retried up to 5 attempts.
- **Permanent rejection** — parked immediately with `failedAt`, not retried.
- **Concurrent drains** — a row is claimed by compare-and-set on `attempts`.
- **No provider** — `drain` returns immediately with a `skipped` count rather
  than re-rendering the oldest batch on every call. The no-provider branch does
  not consume an attempt, so without this those rows would stay permanently
  first in line and newer ones would never be reached.
- **Unknown template** — `renderTemplate` throws by name. `drain` casts a
  database string to `TemplateName`, so a template renamed while rows still
  reference the old one would otherwise return `undefined` and fail five times
  with a `TypeError`.

## Verified by

`npm run verify:mail` (every template renders in both languages, nothing left
unresolved, no inline copy, both dictionaries in step, every enqueued template
exists) and `npm run verify:action-locale`, extended to cover `emails/`,
`lib/outbox.ts` and `lib/certificate.ts`.

## Open

**No mail provider is chosen.** Everything above works against the local driver;
nothing reaches a human until `MAIL_PROVIDER` and `MAIL_API_KEY` are set and a
sending domain is verified.
