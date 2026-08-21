# Spec C — Solo-operator tools

**Status** approved 2026-08-20, not built · **Order** second of three (A → C → B)

## Purpose

One person runs this platform. Their stated fear is not being able to operate
it. Five gaps stand between the shipped admin area and a day's work getting
done, and four of them are half-built already — models and actions exist with
no screen that reaches them.

## Why second

Nothing blocks it, and every item bites in week one. Spec B is the larger
design, but a catalogue of four or five hand-curated albums does not need an
intake pipeline yet; settling a bank transfer, helping a confused buyer, and
handing an accountant a file all start on day one.

## What gets built

### 1. View as this buyer

`beginImpersonation` and `endImpersonation` exist in
`app/(admin)/admin/actions.ts` and the `Impersonation` model exists. **No UI in
the area calls them.** Supporting a buyer who cannot find a download means
guessing what they can see.

**Read-only, audited, expiring** — the choice taken deliberately.

- Entered from the buyer's row in `/admin/orders` and from a user lookup.
- The session is **read-only**: no purchase, no download, no mutation. Every
  server action refuses while impersonating, and the refusal is enforced
  server-side, not by hiding buttons.
- **Expires on its own** after 30 minutes. An operator who forgets is not left
  inside someone's account.
- A **persistent banner** names whose account this is and offers to leave.
- Start and end are written to the audit log with the operator, the subject and
  the reason.

Read-only is what makes this defensible: a buyer disputing an action can be
told, with an audit trail, that no operator could have taken it.

### 2. Price band editor

`PriceBand` has no editor anywhere. Changing what an album size costs means
editing the database by hand.

- Edit the guide price for each band.
- On save, if live albums use that band, offer to **reprice them and notify
  their creators** (`album.repriced`, on the Spec A rail).
- **Completed orders never move.** `OrderItem` carries a frozen price and a
  frozen commission rate; repricing touches neither. A refund still reverses at
  the rate on the order. This is one of the two frozen invariants and the
  editor must not create an exception to it.
- The audit log records the old price, the new price, and how many albums moved.

Once Spec B lands, a band is a *guide* price rather than a rule, and this
editor sets the guide.

### 3. Waitlist reader

Every address captured by the landing page's «نبّهني عند الإطلاق» is stored as
a `CmsEntry` with `kind: 'landing_copy'`, slug `waitlist:<email>`, and **no
screen anywhere reads it back**. Addresses are being collected that cannot be
retrieved.

- A screen listing them with signup dates, newest first.
- CSV export.
- The storage shape is a hack that should be corrected while we are here: a
  waitlist signup is not landing copy. A small `WaitlistSignup` model, with a
  one-time migration of the existing rows, costs little and stops the CMS from
  filling with addresses.

### 4. CSV exports

For the accountant, and for any question a dashboard does not answer.

- Orders — number, date, buyer, entity type, net, VAT, total, status, invoice number.
- Revenue by month.
- Payouts — creator, amount, status, destination, dates.
- Creator earnings — sales, commission at the frozen rate, held, available.

Exported as CSV with a UTF-8 BOM, because Excel opens BOM-less UTF-8 as
mojibake and every one of these files contains Arabic names.

### 5. Payout batching

`PayoutRun` is never read or written by any route, though `/admin/payouts` is
titled «دفعات التحويل» — payout *runs*. Paying creators means approving them
one at a time and typing transfers by hand.

- Select approved payout requests and group them into a `PayoutRun`.
- Generate a bank file for the run. **Format is unknown** — it depends on the
  Egyptian bank and on whether Payoneer and Wise are used, which the /sell page
  says they are. The generator is therefore written behind a small interface
  with **CSV first**, since every bank accepts a CSV import and no bank rejects
  one outright.
- Mark a whole run paid, which marks its requests paid and notifies each
  creator.
- The destination is already frozen at approval; batching must not re-read it.

### 6. Download formats on the clip page

`Clip` carries `masterKey` and `proxyKey` — two files — and the buyer is never
told which formats they get. An editor who needs a specific codec for a grade
wants to know before paying, and this is data that already exists.

Stated on the clip page and on the album page's licence panel.

## Data flow

```
/admin/orders row ─→ beginImpersonation ─→ read-only session (30 min, audited)
                                              └─ banner ─→ endImpersonation

price band edit ─→ [reprice N live albums?] ─→ Album.priceStandard
                                              └─ MailOutbox: album.repriced
                        (OrderItem untouched — frozen)

payout requests ─→ PayoutRun ─→ bank file (CSV) ─→ mark run paid
                                                   └─ MailOutbox: payout.paid
```

## States

- **No live albums on a band** — the reprice prompt is not offered.
- **Impersonation expired mid-session** — the next request drops the session and
  returns the operator to `/admin` with a notice, rather than silently acting as
  themselves.
- **Empty waitlist / no payouts / no orders in range** — an `EmptyState`, and
  export controls disabled rather than producing a header-only file.
- **A payout run with one request** — allowed; batching of one is still a batch.

## Invariants

1. **Completed orders are immutable.** Repricing changes `Album.priceStandard`
   and nothing on any `OrderItem`. Entitlement is served from
   `clipManifestSnapshot`; commission is frozen at purchase.
2. **Impersonation cannot mutate.** Enforced server-side in every action, not by
   hiding controls.
3. **Every impersonation is audited**, start and end, with a reason.
4. **A frozen payout destination stays frozen** through batching.
5. **Exports carry a UTF-8 BOM.**

## Verified by

- `verify:flows` extended: the band editor mutates, the reprice prompt appears
  and repricing leaves `OrderItem` untouched, a payout run reaches paid.
- `verify:entitlement` and `verify:money` must stay green — they are the gates
  that would catch a reprice leaking into a completed order.
- A new `verify:impersonation` — asserts a mutation is refused while
  impersonating, that the session expires, and that both ends are audited.
- `audit` covers the new routes at both widths.
- Specs updated in the same change: `specs/admin/README.md` route table,
  Coverage, and the "Dead ends worth knowing" list, which this spec closes three
  of.

## Relationship to Spec D

Spec D (content control) turns the admin area into a CMS and supersedes part of
this one: the price-band editor built here becomes the editor D exposes
alongside the other operating constants, and `/admin/merchandising` is deleted
by D rather than extended. Build C as written — D layers on top and removes what
it replaces.

## Deliberately not in scope

Team seats and multi-user accounts (deferred). The business/enterprise entry
page (deferred). Indemnification wording (needs counsel). Bank formats beyond
CSV, until the bank is known.

## Open

- **Which bank, and whether Payoneer and Wise are really used.** CSV covers the
  gap; a specific format needs the answer.
