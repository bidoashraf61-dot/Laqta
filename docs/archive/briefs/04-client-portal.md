# Brief 04 — Client Portal, Cart & Checkout

**Branch:** `feat/client` · **Depends on:** Brief 01 (Foundation) merged
**Owns:** `app/[locale]/(account)/account/*`, `app/[locale]/(public)/cart`, `/checkout`, `/pricing`, `/licensing`, `components/account/*`, `components/checkout/*`

---

## Context

**Laqta (لقطة)** — Arabic-first stock-footage marketplace. Buyers purchase **albums** once and own them forever — no subscription. Company registered in **Egypt**; buyers mainly Saudi.

Read `docs/archive/briefs/00-README-START-HERE.md` first.

**You own the money.** This brief is where revenue is collected and where the ownership promise is kept.

---

## Routes you own

```
/cart                          cart
/checkout                      2-step checkout
/pricing  /licensing           plans + licence explainer
/account                       overview
/account/library               ★ owned albums — the post-purchase home
/account/library/[albumId]     clip list + downloads
/account/downloads             download history
/account/purchases             orders
/account/purchases/[orderId]   order detail + invoice + licence cert
/account/boards                saved boards
/account/boards/[id]           board detail + share link
/account/invoices              tax invoices
/account/licences              licence certificates
/account/team                  team seats (business accounts)
/account/billing               payment methods, billing entity, VAT number
/account/settings              profile, language, password, 2FA
```

---

## Two buyer types — build for both

| | Agencies / government | Solo creators |
|---|---|---|
| Ticket | High | Low |
| Needs | Tax invoice, VAT number, PO number, team seats, broadcast licence, **Net-30 bank transfer** | Card, Apple Pay, BNPL instalments |

Government and semi-gov procurement **often cannot pay by card** — bank transfer / invoice is required, not optional. That segment is the revenue engine.

---

## Checkout — 2 steps, no more

**Step 1 — Cart:** line items, licence tier editable inline, promo code, VAT line, total.

**Step 2 — Checkout:**
- **Guest checkout allowed**, account auto-created on purchase (they need one to re-download anyway)
- **Billing entity toggle: فرد (Individual) / منشأة (Business)** → Business reveals company name, CR number, **VAT registration number**, optional PO number. Mandatory for a compliant tax invoice.
- Payment methods:
  - **Egyptian gateway** (Paymob / Fawry / Kashier) — accepts international cards including Saudi buyers
  - Apple Pay
  - **Tabby / Tamara** BNPL for higher tiers
  - **Bank transfer / Net-30 invoice** for enterprise & government
- Order review → Pay

**Confirmation:** instant download start + licence certificate + tax invoice + link to library.

### Invoicing
Company is **Egypt-registered** → **Egyptian ETA e-invoicing**, not Saudi ZATCA. Use a certified provider; do not build e-invoicing yourself. Platform is **principal of record** (pending tax-advisor sign-off) — you issue one invoice to the buyer regardless of creator country.

---

## Licence tiers

| | Standard | Extended |
|---|---|---|
| Price | base | **3× base** |
| Digital, social, web, ads, client work | ✅ | ✅ |
| Broadcast TV, OOH, cinema | ❌ | ✅ |
| Resale as stock, AI/ML training | ❌ | ❌ |

- Tier chosen **at checkout, per album**
- **Upgradeable later** — pay the difference
- Every purchase generates a **bilingual Licence Certificate PDF**: order ID, album, full clip manifest with IDs, buyer legal entity, tier, date, creator. Agencies and broadcasters require this for compliance; it's also a strong trust signal.

---

## ⚠️ The entitlement rule — the core of the product promise

> **Never compute what a buyer owns from the live album.**

Read ownership from `OrderItem.clipManifestSnapshot` — the frozen list of clip IDs captured at purchase. If a creator later edits, replaces or deletes clips, the buyer's library **must not change**. Same for `licenceVersionId`: the licence text in force at purchase governs that order forever.

Getting this wrong silently breaks the "buy once, own forever" promise that the entire business is built on.

---

## Library & downloads

- Download all (chunked ZIP) or per-clip
- **Editing proxies** (H.264 1080p) served alongside masters — editors love this
- **Unlimited re-download, forever.** State it loudly; it's the core of the one-time model.
- Masters via **short-lived signed URLs** (5–15 min), issued only against a valid entitlement
- Log every download (IP, UA, bytes); rate-limit; alert on anomalies (e.g. 40GB from 6 IPs in an hour)

## Boards
Pre-purchase shortlisting. Agencies build a board, share a link with the client, then buy the albums the client picked. **Shared board links must be viewable without an account** — that's the whole workflow.

---

## Acceptance criteria

- [ ] Guest checkout → account auto-created → purchase appears in library
- [ ] Business toggle captures CR + VAT number; tax invoice renders correctly
- [ ] Card, Apple Pay, BNPL and bank-transfer/Net-30 paths all complete
- [ ] Licence certificate PDF generates bilingually with full clip manifest
- [ ] **Entitlement survives album edits** — write a test: buy, then mutate the album, confirm library unchanged
- [ ] Downloads use expiring signed URLs; direct master URLs are not reachable
- [ ] Re-download works indefinitely
- [ ] Board share link opens for a logged-out visitor
- [ ] Licence tier upgrade charges only the difference
- [ ] Full Arabic RTL; VAT and totals formatted in SAR

---

## Schema requests

Note needed fields here — **do not edit `schema.prisma`.**

---

## Explicitly NOT yours

Catalogue browsing and search (05 — you receive items into the cart) · creator payouts (03) · admin refunds (06) · landing (02).
