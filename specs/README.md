# Laqta — functional specifications

One document per implemented surface. Each spec is **derived from the shipped
code**, not from intentions: if a spec and the implementation disagree, the
spec is the bug report.

## How to read a spec

Every spec follows the same shape:

| Section | What it answers |
|---|---|
| **Route** | The URL, and whether it is static, dynamic or parameterised |
| **Access** | Who can load it, and what happens to everyone else |
| **Purpose** | The one job this surface does, in a sentence |
| **Data in** | What it reads, from which models, with which filters |
| **Controls** | Every interactive element and exactly what it mutates |
| **States** | Empty, loading, error, and any role- or data-conditional variants |
| **Invariants** | Rules this surface must never break |
| **Verified by** | Which automated gate covers it |

## The two frozen invariants

Two rules cut across the whole system. Any spec that touches money or
downloads restates them, and no surface may work around them:

1. **Entitlement is served from `OrderItem.clipManifestSnapshot`.** What a
   buyer owns is frozen at purchase. Editing an album later never adds to or
   removes from a completed order.
2. **Commission is frozen at purchase** (`OrderItem.commissionRate`). A
   creator promoted to a better tier in March does not change what they earned
   in January, and a refund reverses at the rate on the order — never the
   creator's current rate.

## Index

- [`public/`](./public) — marketing, catalogue and policy surfaces
- [`account/`](./account) — the buyer's authenticated area
- [`studio/`](./studio) — the creator portal
- [`admin/`](./admin) — the operator control panel
- [`auth/`](./auth) — sign-in, sign-up and the guard model
- [`api/`](./api) — route handlers
- [`localisation.md`](./localisation.md) — the Arabic/English contract, cross-cutting
- [`glossary.md`](./glossary.md) — one word per concept, in both languages

The two frozen invariants have no separate document: they are stated above, enforced
in `lib/orders.ts` (entitlement snapshot, commission freeze) and `lib/admin.ts`
(refund reversal at the frozen rate), and restated by every spec that touches them.

## The bilingual surface

Arabic owns the bare path; English is served under `/en` by a middleware
rewrite onto the same route tree. Any spec describing a public route describes
**both** its languages. See [`localisation.md`](./localisation.md) for the URL
contract, how a request resolves its language, and the SEO rules.

## Contrast

`npm run verify:contrast` drives real Chrome over every public route and all
three dashboards, in **both themes**, and fails on any text under WCAG AA. It
exists because dark mode shipped with four landing sections at 1.05:1 — a
near-white ground kept from light mode under a foreground that had flipped —
and no gate caught it. See the "Grounds and inks travel together" section of
`DESIGN.md` for the rule and the four shapes of the mistake.

## Coverage

58 page routes + 2 API handlers. Every route in `app/` has a spec.
