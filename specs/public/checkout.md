# Checkout

**Route** `/checkout` · **Access** authenticated (any role) · **Rendering** server component, dynamic

## Purpose
Collect the billing entity and payment method, then place the order — the one place entitlement and commission are frozen.

## Data in
- `auth()` for the session.
- `getCart(userId)` — the same read as `/cart`; used for the line summary and totals.
- `User` by id, selecting `billingEntityType`, `legalName`, `crNumber`, `vatNumber`, `billingAddress`, to prefill the form.
- `availableMethods()` from `lib/payments.ts` — read at request time from the environment:
  - **Paymob unconfigured (today's default):** `['bank_transfer']` only.
  - **Paymob configured** (`PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET` and at least one integration id — see [`../api/payments-paymob.md`](../api/payments-paymob.md)): `card` and/or `apple_pay` (only the methods that have an integration id), then `bank_transfer`.
  - `mada`, `tabby` and `tamara` are **never** offered — they are not part of the Paymob integration. (mada-branded cards that Paymob's card integration accepts go through `card`; there is no separate mada rail.)
- Line titles render through `<Bilingual ar en />` (the album's `titleAr` / `titleEn`).
- Display currency taken from the first cart item's album currency, defaulting to `'SAR'`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Individual / Business toggle | Client state | Reveals the business fields; writes a hidden `billingEntityType` input |
| `legalName`, `crNumber`, `vatNumber`, `poNumber` | Form fields (business only) | Passed into `placeOrder`; `legalName` and `vatNumber` are `required` in the DOM and `vatNumber` re-checked server-side |
| `addressLine1`, `city` | Form fields | Composed into `billingAddress` as `{ line1, city, country: 'SA' }` when either is set |
| Payment-method radio | Client state | Writes a hidden `method` input. Renders `availableMethods()`; the first offered method is preselected (card when Paymob is configured) |
| «المتابعة للدفع» (`checkout.continueToPayment`) — card / Apple Pay selected | Server action `placeOrder(formData)` | Refuses a method not in `availableMethods()` (`checkout.gatewayPending`) before any order exists; calls `checkout()` which freezes the order and asks Paymob for an intention; on `redirectUrl` the button locks, reads «ننقلك لصفحة الدفع…» (`checkout.redirecting`) and `window.location.assign()`s to Paymob's Unified Checkout. **The cart is NOT emptied** — the signed callback removes the paid albums from it |
| «تأكيد الطلب» (`checkout.placeOrder`) — bank transfer selected | Server action `placeOrder(formData)` in `app/(public)/checkout/actions.ts` | Zod-validates, calls `checkout()` in `lib/orders.ts`, persists the billing entity onto `User`, empties the cart |
| "اذهب إلى المكتبة" (success) | Link | `/account/library` |

## States
- **Signed out** — `redirect('/sign-in?callbackUrl=/checkout')`.
- **Empty cart** — `redirect('/cart')`.
- **Business without a VAT number** — refused server-side with `checkout.vatNumber` before any order is created.
- **Validation failure** — generic `auth.somethingWentWrong`.
- **Album no longer live at submit time** — `checkout()` returns `cart.unavailable` (the album count must match the line count exactly).
- **Success, unsettled (bank transfer)** — the form is replaced by the success card with the order number, `checkout.successPending`, and the bank-transfer instructions alert.
- **Success, settled** — `checkout.successPaid`. Only possible if a payment driver returns `status: 'paid'`; neither driver does (bank transfer is `awaiting_settlement`, Paymob is `redirect`).
- **Card / Apple Pay chosen, gateway reachable** — order created `pending` with `gatewayRef = PAYMOB-INT-<intention id>`, the buyer leaves for Paymob and comes back to [`/checkout/return`](checkout-return.md). Nothing on this page, or on the return page, marks it paid.
- **Card / Apple Pay chosen, gateway unreachable or refuses** (network error, non-2xx, no `client_secret`, or the order currency ≠ `PAYMOB_CURRENCY`) — the order is set to `status='failed'` and a destructive alert reads `checkout.gatewayError` («ما قدرنا نفتح صفحة الدفع الآن. جرّب مرة ثانية، أو اختر التحويل البنكي.»). The cart is untouched, so the buyer can retry or switch to bank transfer.
- **Paymob not configured** — only bank transfer renders, and an info `Alert` says `checkout.gatewayPending` («الدفع بالبطاقة قيد التفعيل. استخدم التحويل البنكي حالياً.»). The alert is hidden as soon as card or Apple Pay is offered.
- **Card / Apple Pay selected** — a muted line under the methods: `checkout.redirectNote` («تكمل الدفع في صفحة دفع آمنة، وترجع هنا أول ما تخلص.»), and the submit reads `checkout.continueToPayment`.
- **A method not offered is posted** (forged form, or config changed between render and submit) — refused with `checkout.gatewayPending`; no order is created.
- **Pending** — submit button shows `state.loading` and is disabled.
- **Checkout is one step**, not the two-step flow in the original brief; the cart page is treated as step one.

## Invariants
Both frozen invariants (`lib/orders.ts`) are taken here and may never be recomputed downstream:
- **Entitlement** — `OrderItem.clipManifestSnapshot` records the exact clips (id, slug, titles, `masterKey`, `proxyKey`) at the instant of purchase, and `Entitlement.clipIdsSnapshot` mirrors the ids. The buyer's library is served from that snapshot forever; later edits to the album do not move what was bought.
- **Commission** — `commissionRate`, `commissionAmount`, `creatorNetAmount` and `commissionBasis` are resolved once by `resolveCommission()` and written onto the `OrderItem`. A refund must reverse against the stored rate, never a recomputed one. `licenceVersionId` is frozen alongside.
- The billing entity is snapshotted onto `Order.billingEntitySnapshot` — later profile edits must not rewrite an issued invoice.
- Order + items + entitlements + licence certificates are created in one `$transaction`: an order that exists without its entitlements means the buyer paid and owns nothing.
- Only `status='live'` albums can be checked out.
- An unsettled order grants a visible entitlement but no download — settlement (`settleOrder`) is what posts the creator ledger, the 30-day payout hold and the invoice.
- No fake payment path. Card / Apple Pay are paid on Paymob's hosted page; the order becomes `paid` only through the signed server callback, which calls the **same** `settleOrder()` as the admin's manual settle. See [`../api/payments-paymob.md`](../api/payments-paymob.md).
- The buyer is asked for nothing new for card payments. Paymob's required billing fields are filled from the account (`name` or the business `legalName`, `email`, `phone` if present) and `"NA"` for everything else.
- No refund copy on this page or any public payment surface (owner decision 2026-09-23).

## Verified by
`verify:money` (commission frozen; refund reverses the frozen rate), `verify:entitlement` (buy → mutate album → library unchanged), `verify:payments` (which methods are offered with and without Paymob config; the intention request's amount, integration, reference and URLs; a webhook-settled order freezes and credits exactly like a manual one), `audit`. Not in the `verify:arabic` route list. The browser redirect to Paymob's hosted page is not driven by any gate.
