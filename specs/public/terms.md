# Terms of service

**Route** `/terms` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
The binding terms: what a buyer actually purchases, account rules, pricing and invoicing, licence exclusions, creator obligations, and liability limits.

## Data in
- None. Renders the `TERMS` sections and `EFFECTIVE_FROM` (`2026-08-01`) from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. No acceptance checkbox, no versioned consent record — agreeing to these terms is not captured anywhere in the schema on this route.

## States
- No empty, error or loading state — content is a compile-time constant.
- The effective date is rendered from a single hard-coded `EFFECTIVE_FROM` shared by all policy documents; there is no per-document versioning here. (`LicenceVersion` in the schema versions the *album licence*, which is a separate thing.)
- Flagged in-code as drafted but **not yet reviewed by Saudi counsel**; the ZATCA/PDPL references in particular are unconfirmed.

## Invariants
- The prose describes how the product actually behaves — the frozen commission, entitlement served from the order snapshot, the 30-day payout hold, the review checklist. If code changes any of those, this document is wrong and must change with it.
- A policy without a stated effective date is not a policy: the date must always render.

## Verified by
`verify:arabic`, `audit`.
