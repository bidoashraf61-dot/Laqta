# Checkout

**Route** `/checkout` · **Access** authenticated (any role) · **Rendering** server component, dynamic

## Purpose
Collect the billing entity and payment method, then place the order — the one place entitlement and commission are frozen.

## Data in
- `auth()` for the session.
- `getCart(userId)` — the same read as `/cart`; used for the line summary and totals.
- `User` by id, selecting `billingEntityType`, `legalName`, `crNumber`, `vatNumber`, `billingAddress`, to prefill the form.
- `availableMethods()` from `lib/payments.ts` — **today this returns `['bank_transfer']` only**, because every gateway method (`card`, `apple_pay`, `mada`, `tabby`, `tamara`) is filtered out by `isGatewayMethod`.
- Display currency taken from the first cart item's album currency, defaulting to `'SAR'`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Individual / Business toggle | Client state | Reveals the business fields; writes a hidden `billingEntityType` input |
| `legalName`, `crNumber`, `vatNumber`, `poNumber` | Form fields (business only) | Passed into `placeOrder`; `legalName` and `vatNumber` are `required` in the DOM and `vatNumber` re-checked server-side |
| `addressLine1`, `city` | Form fields | Composed into `billingAddress` as `{ line1, city, country: 'SA' }` when either is set |
| Payment-method radio | Client state | Writes a hidden `method` input. Only `bank_transfer` is offered |
| «تأكيد الطلب» (`checkout.placeOrder`) | Server action `placeOrder(formData)` in `app/(public)/checkout/actions.ts` | Zod-validates, calls `checkout()` in `lib/orders.ts`, persists the billing entity onto `User`, empties the cart |
| "اذهب إلى المكتبة" (success) | Link | `/account/library` |

## States
- **Signed out** — `redirect('/sign-in?callbackUrl=/checkout')`.
- **Empty cart** — `redirect('/cart')`.
- **Business without a VAT number** — refused server-side with `checkout.vatNumber` before any order is created.
- **Validation failure** — generic `auth.somethingWentWrong`.
- **Album no longer live at submit time** — `checkout()` returns `cart.unavailable` (the album count must match the line count exactly).
- **Success, unsettled** — the form is replaced by the success card with the order number, `checkout.successPending`, and the bank-transfer instructions alert. This is the only outcome reachable today. The alert's promise ("we'll send you the transfer details and the invoice") is kept by email: after the order is recorded, `checkout()` calls `notifyOrderPlaced(orderId)`, which queues `order.placed` to the buyer — order number, amount due, transfer reference, and the `BANK_*` account details (or "reply for the details" when `BANK_IBAN` is unset). See `specs/mail.md`.
- **Success, settled** — `checkout.successPaid`. Only possible if a payment driver returns `status: 'paid'`; the current manual driver never does.
- **Gateway method chosen** — cannot happen through the UI; if forced, `createPaymentIntent` returns `unavailable`, the order is set to `status='failed'`, and `checkout.gatewayPending` is returned. An `Alert` states plainly that card/Apple Pay/BNPL are pending a gateway.
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
- No fake payment path: gateway methods return an honest refusal rather than flipping an order to paid.
- A mail problem never fails checkout: `notifyOrderPlaced` runs after the order commits, only for `bank_transfer` orders still `pending`, is keyed on the order number (one message per order) and catches its own errors. The receipt (`order.confirmed`) is not sent here — it fires when the order is settled (`settleOrder`, see `specs/admin/admin-orders.md`).

## Verified by
`verify:money` (commission frozen; refund reverses the frozen rate), `verify:entitlement` (buy → mutate album → library unchanged), `verify:mail` (the transfer notice renders in both languages and is queued once per order), `audit`. Not in the `verify:arabic` route list.
