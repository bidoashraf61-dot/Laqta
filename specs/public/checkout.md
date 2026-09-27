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
  - `mada`, `tabby` and `tamara` do **not exist** as methods — they are not part of the Paymob integration. Since DEV-29 (2026-09-27) they are gone from `PAYMENT_METHODS` and their labels («مدى»، «تابي»، «تمارا») are gone from both dictionaries, so nothing can render them. (mada-branded cards that Paymob's card integration accepts go through `card`; there is no separate mada rail.)
- Line titles render through `<Bilingual ar en />` (the album's `titleAr` / `titleEn`).
- The summary box lists each applied bundle as «توفير الحزمة» + title, −saving (success colour), and its VAT and total are after the bundle (from `getCart`).
- Display currency taken from the first cart item's album currency, defaulting to `'SAR'`.

- **Meta description (DEV-38)** — `brand.seo.checkout`, in the page's language.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Individual / Business toggle | Client state | Reveals the business fields; writes a hidden `billingEntityType` input |
| `legalName`, `crNumber`, `vatNumber`, `poNumber` | Form fields (business only) | Passed into `placeOrder`; `legalName` and `vatNumber` are `required` in the DOM and `vatNumber` re-checked server-side |
| `addressLine1`, `city` | Form fields | Composed into `billingAddress` as `{ line1, city, country: 'SA' }` when either is set |
| «كود الخصم» field + «تطبيق» (outline button; Enter applies, never submits) | `previewPromo(code)` in `app/(public)/checkout/actions.ts` → `lib/promos.evaluatePromo` against the cart's albums at their **current** prices | On success a `role=status` box: «خصم الكود {CODE}» −amount (success colour), VAT, «الإجمالي بعد الخصم»; a hidden `promoCode` input carries the applied code; «إزالة الكود» clears it; editing the field un-applies it. On failure an inline `role=alert` line: «الكود غير صحيح أو غير مفعّل.» / «الكود خارج فترة صلاحيته.» / «انتهت مرات استخدام هذا الكود.» / «الكود يحتاج طلباً بقيمة {amount} دولار أو أكثر.» / «الكود لا يشمل الألبومات اللي في سلتك.» (DEV-63). The server summary box above stays at list prices |
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
- **Success, unsettled (bank transfer)** — the form is replaced by the success card with the order number, `checkout.successPending`, and the bank-transfer instructions alert. The alert's promise ("we'll send you the transfer details and the invoice") is kept by email: after the order is recorded, `checkout()` calls `notifyOrderPlaced(orderId)`, which queues `order.placed` to the buyer — order number, amount due, transfer reference, and the `BANK_*` account details (or "reply for the details" when `BANK_IBAN` is unset). See `specs/mail.md`.
- **Success, settled** — `checkout.successPaid`. Only possible if a payment driver returns `status: 'paid'`; neither driver does (bank transfer is `awaiting_settlement`, Paymob is `redirect`).
- **Card / Apple Pay chosen, gateway reachable** — order created `pending` with `gatewayRef = PAYMOB-INT-<intention id>`, the buyer leaves for Paymob and comes back to [`/checkout/return`](checkout-return.md). Nothing on this page, or on the return page, marks it paid.
- **Card / Apple Pay chosen, gateway unreachable or refuses** (network error, non-2xx, no `client_secret`, or the order currency ≠ `PAYMOB_CURRENCY`) — the order is set to `status='failed'` and a destructive alert reads `checkout.gatewayError` («ما قدرنا نفتح صفحة الدفع الآن. جرّب مرة ثانية، أو اختر التحويل البنكي.»). The cart is untouched, so the buyer can retry or switch to bank transfer.
- **Paymob not configured** — only bank transfer renders, with **no** note about card payment "being switched on" (removed in DEV-29: a checkout states the methods it takes, not the ones it may take later).
- **Card / Apple Pay selected** — a muted line under the methods: `checkout.redirectNote` («تكمل الدفع في صفحة دفع آمنة، وترجع هنا أول ما تخلص.»), and the submit reads `checkout.continueToPayment`.
- **A method not offered is posted** (forged form, or config changed between render and submit) — refused with `checkout.gatewayPending` («وسيلة الدفع هذي مو متاحة. اختر وحدة من الوسائل المعروضة.» / "That payment method is not available. Choose one of the methods shown."); no order is created. A method outside `PAYMENT_METHODS` (e.g. `mada`) fails the Zod enum and gets `auth.somethingWentWrong`.
- **Pending** — submit button shows `state.loading` and is disabled.
- **Checkout is one step**, not the two-step flow in the original brief; the cart page is treated as step one.

## Invariants
- **Bundles (DEV-62)** — `checkout()` runs `resolveBundles(bundleLines(albums))` on the albums as they are now: a running bundle applies when every one of its albums is in the order; overlapping bundles — the biggest saving wins, then the next that shares no album. A bundle whose discount would exceed Laqta's commission on any album is skipped. On a bundled line: `discountAmount` = its share, `grossAmount` = price − share, `bundleId` set, and **the creator's `creatorNetAmount` is what the album earns on its own** (`resolveCommission` on the pre-bundle price) — Laqta's `commissionAmount` = paid − that, `commissionRate` its effective rate, `commissionBasis.bundle = { preDiscountGross, discount, fundedBy: 'platform' }` (owner decision 2026-09-27). `Order.bundleDiscountAmount` records the total. **Promo codes do not stack:** the code is evaluated only on albums outside an applied bundle (a cart that is all bundle → `promo.notApplicable`); `previewPromo` does the same.
- **Offers** (DEV-60) — each line's price is `priceNow(album)`: a running offer's price inside its dates, else the regular `priceStandard`. A promo code then applies on top of that price.
- **Promo codes (DEV-63)** — `checkout()` re-evaluates the posted `promoCode` itself (the preview is not the boundary): active, inside `startsAt`–`endsAt`, under `maxRedemptions`, cart ≥ `minOrderTotal`, and — when `albumIds` is set — only those albums. The discount is split across eligible lines (percent per line; fixed pro-rata, cents remainder on the last line). Each `OrderItem.grossAmount` is the price **after** its `discountAmount`, so VAT, commission, the creator ledger and refunds run on what was paid. `Order.promoCode`, `promoCodeId`, `discountAmount` record it. One redemption is taken inside the order's transaction with an atomic `redemptions < maxRedemptions` update — the last use cannot be taken twice (`promo.exhausted`); an unpaid order still used its redemption.
Both frozen invariants (`lib/orders.ts`) are taken here and may never be recomputed downstream:
- **Entitlement** — `OrderItem.clipManifestSnapshot` records the exact clips (id, slug, titles, `masterKey`, `proxyKey`) at the instant of purchase, and `Entitlement.clipIdsSnapshot` mirrors the ids. The buyer's library is served from that snapshot forever; later edits to the album do not move what was bought.
- **Commission** — `commissionRate`, `commissionAmount`, `creatorNetAmount` and `commissionBasis` are resolved once by `resolveCommission()` and written onto the `OrderItem`. A refund must reverse against the stored rate, never a recomputed one. `licenceVersionId` is frozen alongside — always the **current** `LicenceVersion` (`lib/licence.currentLicenceId()`), never the album's own pointer, which studio albums once lacked (DEV-06). With no current licence the checkout refuses (`cart.unavailable`, logged) rather than sell a blank licence.
- The billing entity is snapshotted onto `Order.billingEntitySnapshot` — later profile edits must not rewrite an issued invoice.
- Order + items + entitlements + licence certificates are created in one `$transaction`: an order that exists without its entitlements means the buyer paid and owns nothing.
- Only `status='live'` albums can be checked out.
- An unsettled order grants a visible entitlement but no download — settlement (`settleOrder`) is what posts the creator ledger, the 30-day payout hold and the invoice.
- No fake payment path. Card / Apple Pay are paid on Paymob's hosted page; the order becomes `paid` only through the signed server callback, which calls the **same** `settleOrder()` as the admin's manual settle. See [`../api/payments-paymob.md`](../api/payments-paymob.md).
- The buyer is asked for nothing new for card payments. Paymob's required billing fields are filled from the account (`name` or the business `legalName`, `email`, `phone` if present) and `"NA"` for everything else.
- No refund copy on this page or any public payment surface (owner decision 2026-09-23).
- A mail problem never fails checkout: `notifyOrderPlaced` runs after the order commits, only for `bank_transfer` orders still `pending`, is keyed on the order number (one message per order) and catches its own errors. The receipt (`order.confirmed`) is not sent here — it fires when the order is settled (`settleOrder`, see `specs/admin/admin-orders.md`).

## Verified by
`verify:offers` (checkout charges a running offer, and the regular price before and after its dates), `verify:promos` (every refusal rule, percent and fixed maths, album-limited codes, the order records code and discount, lines paid at list less share, creator paid on the price paid, redemption counted, a one-use code works once, an invalid code places no order), `verify:licence` (no album or order item without a licence; exactly one current), `verify:money` (commission frozen; refund reverses the frozen rate), `verify:entitlement` (buy → mutate album → library unchanged), `verify:mail` (the transfer notice renders in both languages and is queued once per order), `verify:payments` (which methods are offered with and without Paymob config; mada/Tabby/Tamara are neither methods nor copy, and no "being activated" line exists (DEV-29); the intention request's amount, integration, reference and URLs; a webhook-settled order freezes and credits exactly like a manual one), `audit`. Not in the `verify:arabic` route list. The browser redirect to Paymob's hosted page is not driven by any gate.
