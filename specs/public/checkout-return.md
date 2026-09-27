# Checkout return

**Route** `/checkout/return` · **Access** authenticated (any role; signed-out visitors are sent to sign-in and brought back with the query intact) · **Rendering** server component, dynamic (`searchParams` + `auth()`), `noindex`

## Purpose
Where Paymob's hosted checkout sends the buyer back. It tells the buyer honestly where their payment stands — and it **only reads**. Nothing on this page can mark an order paid; only the signed server callback at [`/api/payments/paymob`](../api/payments-paymob.md) does.

## Data in
- `searchParams` — whatever Paymob appends to `redirection_url`. Used: `merchant_order_id` (our order number, sent as `special_reference`), `success`, `pending`, `hmac`, and the fields the redirect HMAC covers.
- `auth()` for the session.
- `Order.findFirst` scoped to **this buyer**: by `orderNumber = merchant_order_id`; if Paymob omits it, the buyer's latest `card` / `apple_pay` order from the last two hours. Selects `orderNumber`, `status` and the most recent `PaymentEvent.outcome`.
- `paymobConfig()` — only to verify the redirect's own HMAC (`redirectHmac`, GET field names `id` and `order`/`order_id`).

- **Meta description (DEV-38)** — `brand.seo.checkoutReturn`, in the page's language.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «افتح مكتبتك» (`checkout.goToLibrary`, paid) | Link, gold | `/account/library` |
| «ارجع للسلة» (`checkout.backToCart`, failed) | Link, gold | `/cart` — the albums are still there |
| «افتح مشترياتي» (`checkout.viewPurchases`, unknown / slow) | Link, outline | `/account/purchases` |
| (pending) `ReturnPending` | `router.refresh()` every 3 s, 20 times | Re-renders this server page, which re-reads the order. No endpoint of its own |

## States
Decided in this order, first match wins:
- **Signed out** — `redirect(/sign-in?callbackUrl=<this URL with query>)`, locale-prefixed.
- **Unknown** — no matching order for this buyer. `SearchX` icon, `checkout.returnUnknownTitle` «ما لقينا هذا الطلب» / `returnUnknownBody`, link to purchases.
- **Paid** — `Order.status === 'paid'`. Oasis check, `checkout.returnPaidTitle` «تم الدفع», order number (`.numeric`), `returnPaidBody`, gold link to the library. **The only way to reach this state is the server callback having settled the order.**
- **Failed** — `Order.status === 'failed'`, or the latest `PaymentEvent` is `declined`, or the redirect's HMAC verifies and says `success=false` with `pending` not `true`. Clay alert icon, `checkout.returnFailedTitle` «ما اكتمل الدفع», `returnFailedBody` (albums still in the cart; try again or bank transfer), gold link to the cart. A redirect saying `success=false` WITHOUT a valid HMAC does not produce this state — it stays pending.
- **Pending** — anything else, including a redirect that claims `success=true`. Spinner, `checkout.returnPendingTitle` «نتأكد من الدفع», `returnPendingBody`; refreshes itself for one minute.
- **Pending, slow** — after 20 refreshes: `checkout.returnSlowBody` (no need to pay again; status will show in purchases) and an outline link to purchases.

## Invariants
- **Read-only.** The query string is the buyer's browser repeating what Paymob said; it is never trusted to settle. `success=true` in the URL shows *pending*, not *paid*.
- Orders are always scoped to the signed-in buyer — another user's order number resolves to *unknown*.
- One gold element per state (One Voice Rule): the primary link. Status colour is signal only — oasis for paid, clay for failed.
- No refund copy (owner decision 2026-09-23). The failure copy says what to do next, not what happened to money.
- Copy in `checkout.return*` exists in both `ar.json` and `en.json`; `/en/checkout/return` renders English.

## Verified by
`audit` (route list includes `/checkout/return`; with no query it renders the *unknown* state for the seeded buyer). The *paid* transition is covered at the handler level by `verify:payments`; the page-level poll from pending to paid was checked by hand against a local server with a signed callback, not by a gate.
