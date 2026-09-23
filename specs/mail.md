# Transactional email — cross-cutting

**Applies to every surface that owes someone a message.** Built from
`docs/superpowers/specs/2026-08-20-transactional-email-design.md`; the provider
is **Resend** (owner decision, 2026-09).

## Purpose
Before this, the platform sent nothing at all. A buyer paid and heard silence, a
bank-transfer buyer was promised "we'll send you the transfer details" and never
got them, a creator's album went live (or was delisted) without being told, and
an album entered the review queue with no way for the operator to know but to
refresh a dashboard.

## The machinery

| Piece | File | Notes |
|---|---|---|
| Driver + verification tokens | `lib/mail.ts` | `resend` driver (plain `fetch`) + honest local driver; `isMailConfigured()` / `mailConfigured` |
| Events → messages | `lib/notifications.ts` | `notifyOrderPlaced`, `notifyOrderPaid`, `attachCertificates`, `notifyAlbumDecision`, `notifyContactMessage`, `operatorAddress` |
| Outbox (queue, drain, retry) | `lib/outbox.ts` | `enqueue(tx, …)`, `drain()`, `drainSoon()` |
| Templates | `emails/registry.ts` | Pure `(locale, payload)` → blocks |
| Layout | `emails/layout.ts` | Blocks → HTML part + text part, one source |
| Copy | `messages/*.json` → `email.*` | 66 keys, both languages |
| PDF renderer | `lib/documents.ts` | Chrome via Playwright |
| Licence certificate | `lib/certificate.ts` | Rendered per order item, attached to the receipt |
| Absolute URLs | `lib/site.ts` | `SITE_ORIGIN`; a sender has no request |

## Why an outbox and not a send

A message is never sent from inside the transaction that creates the thing it
describes, and a mail failure never rolls that thing back — someone who paid
owns what they bought whether or not a mail server was reachable. `enqueue`
takes the transaction client, so "it happened" and "an email is owed" commit
together. `drain` sends afterwards.

The third benefit is the one that matters for a solo operator: a failed send is
*visible*. `/admin/settings` shows pending, sent and failed counts.

## The Resend driver

`sendMail(to, subject, text, attachments?, { html?, replyTo?, idempotencyKey? })`.
With `MAIL_PROVIDER=resend`, `MAIL_API_KEY` and `MAIL_FROM` all set it POSTs to
`https://api.resend.com/emails`:

- `Authorization: Bearer $MAIL_API_KEY`, `Content-Type: application/json`,
  `Idempotency-Key: outbox:<row id>` (Resend keeps it 24 h).
- Body: `from` = `MAIL_FROM` verbatim (display name allowed, e.g.
  `لقطة <orders@mail.laqta.sa>`), `to: [address]`, `subject`, `text`, `html`,
  `reply_to` (per-message value, else `MAIL_REPLY_TO`), `attachments:
  [{ filename, content: base64 }]` only when there are any.
- Non-2xx throws `resend <status>: <name>: <message>`; the outbox stores it as
  `lastError`. `invalid recipient` / ``invalid `to` `` / `550` / `blocked` /
  `suppress` park the row (`failedAt`); anything else retries up to 5 attempts.

No SDK dependency: one POST does not justify one, and a `fetch` is what
`verify:mail` intercepts to check the request shape without a network. No key
is ever written in code.

With any of the three variables missing, the **local driver** logs the message
to the server console and returns `false`; `drain` returns early with a
`skipped` count and rows stay pending until a provider exists.

## The messages

| Template | Fires from | To | Contents |
|---|---|---|---|
| `order.placed` | `checkout()` → `notifyOrderPlaced(orderId)`, after a `bank_transfer` order is recorded as awaiting settlement | Buyer | Order number, amount due, transfer reference (`gatewayRef`, `BT-…`), bank name / account name / IBAN / SWIFT from `BANK_*` env; with no `BANK_IBAN`, "reply and we'll send the account details and invoice". Button → `/account/purchases`. |
| `order.confirmed` | `settleOrder()` → `notifyOrderPaid(orderId, { client: tx })` inside the settlement transaction — the admin «تأكيد الدفع» path and any future gateway webhook that calls `settleOrder` | Buyer | Album titles, order number, subtotal / VAT / total as frozen on the Order, button → `/account/library`, licence certificate(s) attached once rendered |
| `album.approved` | `decideReview` approve → `notifyAlbumDecision(albumId)` | Creator | Button → the live album page |
| `album.changes` | `decideReview` request changes → `notifyAlbumDecision` | Creator | The reviewer's note, button → `/studio/albums/[id]` |
| `album.rejected` | `decideReview` reject → `notifyAlbumDecision` | Creator | The reviewer's reason (mandatory), an invitation to reply, button → `/studio/albums` |
| `album.priced` | Spec B (written, not yet fired) | Creator | — |
| `review.queued` | `submitForReview` | Operator (`operatorAddress()`) | Album, creator, button → `/admin/review` |
| `contact.message` | `sendContactMessage` stores a `ContactMessage` row first, then `notifyContactMessage(input)`; a mail failure never loses the message (it is in `/admin/messages`) and `mailDelivered` records whether it was queued | Operator (`operatorAddress()`) | Name, email, subject, sender's language, the message; **Reply-To is the visitor** |

`reject` used to be deliberately silent. It is now told: a creator whose album
turns "delisted" with no message learns it from a status chip with no reason,
and `admin.decisionNote` already forces the written reason the message quotes.

`order.settled` is retired — one receipt serves every rail. No row ever named it
(it was never enqueued).

### The contact-form contract

```ts
notifyContactMessage(input: {
  name: string; email: string; subject?: string; message: string; locale: 'ar' | 'en'
}): Promise<void>
```

Queues one `contact.message` to `MAIL_OPERATOR_TO` (fallback `OPERATOR_EMAIL`)
in Arabic. Trims and caps fields (name/subject 200, message 5000); an address
that does not look like one is dropped rather than used as Reply-To. Throws only
if the row cannot be stored — here the message *is* the operation, so the form
must be able to report failure. With no operator address it logs the message
with `console.error` and returns.

## Layout

One block list per message — `p`, `list`, `details`, `quote`, `button`, `note` —
rendered by `emails/layout.ts` into both parts, so the HTML and the text never
say different things.

- Table layout, inline styles; a `<style>` block only for the phone breakpoint
  (≤480 px: 16 px gutter, 20 px inner padding). Clients that drop it keep the
  desktop padding.
- Paper `#FAF8F3` ground, white card, ink `#14141A` text, muted `#EFEBE2` for
  quotes and rules, border `#CFC8BB`, sand `#E9DCC3` tagline.
- The ink band at the top is the letterbox, holding the wordmark and tagline.
- **Gold `#7A6127` appears once**, on the single primary button, with paper
  text on it (One Voice Rule). `verify:mail` counts it.
- Two-cut headline: a light sans lead line («وصلنا طلبك،») over a bold serif
  statement («وننتظر تحويلك.»).
- No web fonts — Thmanyah does not load in mail. Arabic sans stack:
  `-apple-system, SF Arabic, Geeza Pro, Segoe UI, Tahoma, Noto Sans Arabic,
  Arial`; Arabic serif: `Noto Naskh Arabic, Geeza Pro, Times New Roman`.
  English: system sans and Georgia.
- `<html lang dir>` from the locale; alignment is **derived** from the direction
  (`text-align` / `align` = right for `rtl`, left for `ltr`) because Outlook and
  older Gmail ignore `start`. Nothing is hard-coded to one side.
- Values in `details` rows (order numbers, amounts, IBAN) are `dir="ltr"`
  isolates. Values interpolated into sentences (album titles, names, order
  numbers) are wrapped in U+2068/U+2069 isolates, which work in the text part
  too.
- `color-scheme: light only` — forced dark mode would invert paper and ink.
- Every dynamic string is HTML-escaped; only `http(s)` URLs become an `href`.
- A hidden preheader carries the first paragraph.

## Invariants

1. **Locale is frozen on the outbox row**, read from `User.locale` when the
   event happens (operator messages use the product default, Arabic). A sender
   has no render scope, so `t()` would answer every recipient in Arabic.
   Templates use `translate(locale, key)` through a local `tr` binding.
2. **No sentence is written in a template.** Copy lives in `messages/*.json`.
3. **A mail failure never fails the operation that owed the message.**
   Post-commit notifiers catch and log. `notifyOrderPaid` runs inside the
   settlement transaction and only reads and inserts; it rethrows there,
   because a failed statement has already aborted the transaction.
4. **Idempotent per event.** `order.placed` and `order.confirmed` are keyed on
   `payload.orderNumber`, album decisions on `payload.taskId`; a second call
   finds the first row. `settleOrder` flips the order with a compare-and-set
   (`updateMany where status != paid`), so two racing settlements post the
   ledger, the invoice and the receipt once. The drain passes the row id as
   Resend's `Idempotency-Key`, so a retry after a timeout does not resend.
5. **A missing attachment never withholds the message.** The receipt says the
   certificate is *attached* only once `attachCertificates` has set
   `payload.certificateAttached`; otherwise it points at the library.
6. **The absence of a provider is visible, never simulated.**
7. **Money is read, never recomputed** — subtotal / VAT / total come off the
   Order as `lib/orders.ts` froze them. Nothing here touches entitlement or
   commission.
8. **Copy rules.** The catalogue is AI-generated — no message claims footage was
   filmed or shot anywhere. Refunds are never mentioned. No "first" / "largest"
   claims. Enforced by `verify:mail` on every rendered message and every
   `email.*` string.

## States

- **No provider configured** — rows stay pending; `drain` returns
  `{ skipped: n }` without touching them; `/admin/settings` shows mail as
  inactive.
- **Transient failure** — retried up to 5 attempts.
- **Permanent rejection** — parked immediately with `failedAt`, not retried.
- **Concurrent drains** — a row is claimed by compare-and-set on `attempts`.
- **Unknown template** — `renderTemplate` throws by name.
- **Legacy rows** — `order.confirmed` rows queued before the HTML templates
  carry `albums` as one bulleted string; the template still renders them.
- **No bank details configured** — `order.placed` omits the account rows and
  asks the buyer to reply for them.
- **No operator address** — `review.queued` is skipped; `contact.message` is
  logged, not queued.

## Environment

| Variable | Purpose |
|---|---|
| `MAIL_PROVIDER` | `resend` |
| `MAIL_API_KEY` | Resend API key (`re_…`), sending access |
| `MAIL_FROM` | Sender on a verified domain, e.g. `لقطة <orders@mail.laqta.sa>` |
| `MAIL_REPLY_TO` | Default Reply-To for buyer and creator mail |
| `MAIL_OPERATOR_TO` | Operator inbox: review queue + contact form (`OPERATOR_EMAIL` still read as fallback) |
| `SITE_ORIGIN` | Origin for every link in mail (falls back to `AUTH_URL`) |
| `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_IBAN`, `BANK_SWIFT` | Quoted in `order.placed` |

## Owner setup — Resend

1. **Create the account** at resend.com and add the sending domain. Use a
   subdomain such as `mail.laqta.sa`, so mail reputation and DNS stay separate
   from the root domain's own mailboxes. Pick the region nearest the buyers
   (Resend offers `eu-west-1` among others).
2. **Add the DNS records Resend shows** at the domain's DNS host, exactly as
   given (values are per-account):
   - **DKIM** — a `TXT` record at `resend._domainkey.mail.laqta.sa` holding the
     public key Resend generates.
   - **SPF** — on the `send.mail.laqta.sa` return-path subdomain: an `MX` record
     pointing at Resend's feedback host and a `TXT` record
     `v=spf1 include:amazonses.com ~all` (Resend shows the exact values). This
     does not touch the root domain's existing SPF.
   - **DMARC** — a `TXT` record at `_dmarc.laqta.sa` (or `_dmarc.mail.laqta.sa`).
     Start with `v=DMARC1; p=none; rua=mailto:dmarc@laqta.sa;` to collect reports,
     then move to `p=quarantine` once reports show only Resend and the company's
     own mail servers sending as the domain.
3. **Wait for "Verified"** on the Resend domain page (minutes to a few hours).
4. **Create an API key** with *Sending access* restricted to that domain.
5. **Set the environment** on the server (never in the repo): `MAIL_PROVIDER=resend`,
   `MAIL_API_KEY`, `MAIL_FROM="لقطة <orders@mail.laqta.sa>"`,
   `MAIL_REPLY_TO` (an inbox someone reads), `MAIL_OPERATOR_TO`, `SITE_ORIGIN`
   (the public https origin), and the `BANK_*` details. Restart.
6. **Check** `/admin/settings`: the Mail panel turns active; pending rows drain
   on the next queued message. Place a bank-transfer order with a real inbox to
   see `order.placed`, then mark it paid for `order.confirmed` with the
   certificate attached.

## Verified by

`npm run verify:mail`:
- every template renders in both languages, HTML and text; nothing left
  unresolved; no dot-paths; `lang`/`dir` declared; Arabic present in `ar`, no
  Arabic prose in `en`; untrusted markup escaped; gold at most once;
- no refund, filmed-on-location or first/largest copy in any rendered message
  or `email.*` string;
- no inline Arabic in `emails/` or `lib/notifications.ts`; both dictionaries in
  step; every enqueued template exists;
- the Resend request shape against a mocked `fetch` (endpoint, Bearer key,
  Idempotency-Key, `from`, `to[]`, `text`+`html`, `reply_to` default and
  override, base64 attachments, error text on 422), and the local fallback;
- against the database: `notifyOrderPlaced` twice → one row, in the buyer's
  stored locale; two concurrent `settleOrder` calls → one receipt and one
  invoice; `notifyOrderPaid` afterwards → the same row; no receipt for an
  unpaid order; `notifyContactMessage` → one row to `MAIL_OPERATOR_TO`.
  The gate blanks the `MAIL_*` variables first and uses `.test` addresses, so
  it never sends real mail.

`npm run verify:action-locale` covers `emails/`, `lib/outbox.ts`,
`lib/certificate.ts` and `lib/notifications.ts`.

## Open

- **Nothing reaches a human until the owner completes the Resend setup above.**
- Email verification (`issueEmailVerification` in `lib/mail.ts`) still sends a
  plain Arabic-only text message written inline, not through the registry.
- `album.priced` is written but not fired (Spec B).
- No bounce/complaint webhook from Resend yet: a hard bounce is only seen as a
  failed send when Resend rejects synchronously.
- There is no scheduled drain: rows drain after the request that queued
  something (`drainSoon`). A row left pending while no provider was configured
  goes out with the next message queued after one is.
