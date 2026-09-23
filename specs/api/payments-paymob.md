# Paymob transaction callback

**Route** `/api/payments/paymob` (POST; GET redirects) · **Access** public, authenticated by HMAC only — no session, no cookie, no CSRF · **Rendering** dynamic route handler (Node runtime, `force-dynamic`)

## Purpose
Receive Paymob's server-to-server "transaction processed" callback and, when it is genuine and matches the frozen order exactly, mark the order paid through `settleOrder()` — the same function the admin's manual «تأكيد التحويل» uses. This is the **only** way a card or Apple Pay order becomes paid.

**Dormant until configured.** With any of `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET` or an integration id missing, `paymobConfig()` is `null`: checkout offers bank transfer only and this route answers `503 unconfigured` without reading the body.

## The flow end to end
1. `/checkout`, card or Apple Pay → `checkout()` in `lib/orders.ts` freezes the order (manifest + commission, unchanged) and calls `createPaymentIntent()` → the Paymob driver (`lib/paymob.ts`, `createPaymobIntention`).
2. `POST {PAYMOB_BASE_URL}/v1/intention/`, header `Authorization: Token <PAYMOB_SECRET_KEY>`, body:
   - `amount` — `Order.total` in minor units (`toMinorUnits`, no float drift), `currency` — `PAYMOB_CURRENCY` (must equal `Order.currency`, else refused before the call);
   - `payment_methods: [<integration id of the chosen method>]` — one, never both;
   - `items: [{ name: "Laqta <orderNumber>", amount, quantity: 1 }]`;
   - `billing_data` — `first_name`/`last_name` from the business `legalName` or the account `name`, `email`, `phone_number` if the account has one, **`"NA"` for every other field** (Paymob's documented placeholder; the buyer is asked for nothing extra);
   - `special_reference: <orderNumber>` (returns as `obj.order.merchant_order_id`), `extras: { laqta_order_id }`;
   - `notification_url: {SITE_ORIGIN}/api/payments/paymob`, `redirection_url: {SITE_ORIGIN}[/en]/checkout/return`.
3. Response `client_secret` → buyer is sent to `{PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=…&clientSecret=…`. `Order.gatewayRef = PAYMOB-INT-<intention id>`, status stays `pending`, the cart is kept.
4. Paymob POSTs here → verified → `settleOrder(orderId, 'PAYMOB-<transaction id>')` → the paid albums are removed from the buyer's cart.
5. The browser lands on [`/checkout/return`](../public/checkout-return.md), which only reads.

## Data in
- Query `hmac` — hex HMAC-SHA512 of the transaction, keyed on `PAYMOB_HMAC_SECRET`.
- JSON body `{ type: 'TRANSACTION', obj: {…} }`. The HMAC string is the values of these `obj` fields concatenated **in this exact order**, booleans as `true`/`false`, missing values as empty: `amount_cents, created_at, currency, error_occured, has_parent_transaction, id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded, is_standalone_payment, is_voided, order.id, owner, pending, source_data.pan, source_data.sub_type, source_data.type, success` (Paymob docs, "HMAC Transaction Callback"; the gate checks the string against Paymob's published example).
- `Order` by `orderNumber = obj.order.merchant_order_id`, falling back to `id = obj.payment_key_claims.extra.laqta_order_id`.
- Writes `PaymentEvent` (new model, additive migration `20260924120000_payment_events`): `gateway='paymob'`, `transactionId`, `state` (`success | failed | pending | refunded | voided`), `orderId`, `outcome`, `amountCents`, `currency`, `payload` (the verified `obj`). Unique on `(gateway, transactionId, state)`.

## Controls
No UI. The route is called by Paymob, never linked.

| Control | Action | Effect |
| --- | --- | --- |
| Paymob "Transaction processed callback" | `POST /api/payments/paymob?hmac=…` | `handlePaymobCallback()` in `lib/paymob-callback.ts` — see States |
| A misconfigured "Transaction response callback" pointed here | `GET /api/payments/paymob?…` | `303` to `/checkout/return` with the same query. A browser is never trusted to settle |

## States
In order; each gate is passed before the next runs.
- **Unconfigured** → `503 {"outcome":"unconfigured"}`.
- **No body / no `obj`** → `400 malformed`.
- **`type` other than `TRANSACTION`** (card-token, subscription callbacks) → `200 ignored`. Nothing read or written.
- **HMAC missing, wrong, or body altered after signing** → `401 bad_signature`. Compared with `timingSafeEqual`. **No database read or write** — a forged request leaves only a log line.
- **Replay** of the same transaction in the same state → `200 replay`. The claim is a `createMany({ skipDuplicates })` on the unique key, so two concurrent deliveries cannot both proceed.
- **Order not found** → `200 unknown_order` (recorded, `orderId` null).
- **Refunded / voided at Paymob** → `200 reversed_at_gateway`. Recorded and flagged on `/admin/orders`; Laqta's ledger is **not** touched — refunds stay an operator decision in the admin.
- **Pending** → `200 pending`. **Declined** (`success=false` or `error_occured`) → `200 declined`; the order stays `pending` so a retry on the same intention can still succeed; `/checkout/return` shows the failure.
- **Amount or currency ≠ the frozen order** (`amount_cents ≠ toMinorUnits(Order.total)` or `currency ≠ Order.currency`) → `200 amount_mismatch`. **Not settled**; the order stays `pending` and is flagged in the admin.
- **`integration_id` not one of ours** → `200 integration_mismatch`, not settled.
- **Order already paid** (e.g. settled by hand) → `200 already_paid`. **Order not pending** (`failed`, refunded) → `200 order_not_pending`, flagged.
- **Success** → `settleOrder()`; `200 settled`. If `settleOrder` throws, the claim row is deleted and the route answers `500 error` so Paymob retries.
- Every recorded outcome answers 2xx on purpose: it was handled, and a retry would not change the answer.

## Invariants
- **One paid path.** `settleOrder()` is the only writer of `status='paid'`, shared with the admin's manual settle; the ledger credit, 30-day hold, invoice and queued `order.confirmed` mail are identical whichever rail got there. Nothing here recomputes entitlement (`OrderItem.clipManifestSnapshot`) or commission — both were frozen at checkout.
- HMAC before anything. Field order is the contract — never re-sort or "tidy" `TRANSACTION_FIELDS`.
- Idempotent on `(transactionId, state)`, not on transaction id alone: Paymob re-sends the same id when a transaction is later refunded or voided, and that must be seen, not swallowed.
- A mismatch is a failure, never a success, and never a silent one.
- The return page and the browser redirect never settle.
- The middleware matcher excludes `api/payments`, so no session, locale or role logic runs in front of this route.
- No keys in the repo. The gate generates a throwaway secret at runtime.
- mada, Tabby and Tamara are not part of this integration and are never offered.

## Owner setup in the Paymob dashboard
Until these are done, card and Apple Pay stay hidden and nothing changes for buyers.
1. **Region.** Log in on the account's own region — `accept.paymob.com` (Egypt) or `ksa.paymob.com` (KSA). Set `PAYMOB_BASE_URL` to that origin; keys from one region do not work on the other.
2. **Keys.** Settings → Account info: copy the **Secret key** → `PAYMOB_SECRET_KEY`, the **Public key** → `PAYMOB_PUBLIC_KEY`, the **HMAC** secret → `PAYMOB_HMAC_SECRET`. Store them in the host's secret store, never in the repo.
3. **Integrations per currency.** Developers → Payment integrations: you need an **Online Card** integration and an **Apple Pay** integration **that settle in USD** (Paymob integrations are per currency — an EGP integration will refuse a USD intention). Put their ids in `PAYMOB_INTEGRATION_IDS="card:<id>,apple_pay:<id>"`. Leave `PAYMOB_CURRENCY=USD`. If only card is approved, set only the card id — Apple Pay stays hidden.
4. **Callbacks.** On each integration set the **Transaction processed callback** to `https://<your domain>/api/payments/paymob` and the **Transaction response callback** to `https://<your domain>/checkout/return` (the intention also sends both, per payment). The domain must be public HTTPS; Paymob cannot call localhost. Set `SITE_ORIGIN` to the same origin.
5. **Apple Pay.** Paymob must enable Apple Pay on the account and verify the domain; follow their Apple Pay onboarding for the production domain.
6. **Ask Paymob to confirm, in writing:** (a) that the account may charge **USD**; (b) that **Saudi-issued and other international Visa/Mastercard** cards are accepted on it, and whether **mada** co-badged cards are processed through the card integration; (c) settlement currency and FX into the Egyptian bank account, and fees on USD / international cards.
7. **Test first.** Use Paymob's test-mode keys and test integration ids on a staging domain, pay with Paymob's test cards, and confirm the order flips to «مدفوع» on `/admin/orders` with «تأكيد الدفع: تلقائي من بوابة الدفع». Then swap in live keys.

## Verified by
`verify:payments` (in `npm run verify`): the HMAC string against Paymob's published example; forged, tampered and missing signatures rejected with no row written; unconfigured → 503; replay acknowledged with no second ledger row or invoice; amount, currency and integration mismatches recorded and not settled; declined recorded and not settled; a valid success settles and records `PAYMOB-<id>`; a webhook-settled order and a manually settled order of the same album carry the same frozen commission, ledger credit, hold, clip manifest and library entry; the intention request's endpoint, auth header, minor-unit amount, single integration, `special_reference`, URLs and `"NA"` fields against a stubbed `fetch`; which methods are offered with and without config. **Not covered:** a real Paymob round trip, Paymob's hosted page, Apple Pay domain verification.
