# Brief 03 — Creator Portal (Studio)

**Branch:** `feat/studio` · **Depends on:** Brief 01 (Foundation) merged
**Owns:** `app/[locale]/(studio)/studio/*`, `app/[locale]/(public)/sell/*`, `app/[locale]/(public)/creators/*`, `components/studio/*`

---

## Context

**Laqta (لقطة)** — Arabic-first stock-footage marketplace. Creators upload **albums** (coherent themed sets of clips); buyers purchase an album once and own it forever. Platform takes a commission. Creators are **mainly Egyptian at launch**, buyers mainly Saudi.

Read `docs/archive/briefs/00-README-START-HERE.md` first.

**Your users are the supply side.** If creators don't onboard, there's no marketplace. This portal has to feel worth their time.

---

## Routes you own

```
/sell                      creator recruitment landing
/sell/apply                application form
/creators                  public creator directory
/creators/[handle]         public creator storefront
/studio                    dashboard
/studio/albums             album manager
/studio/albums/new         creation wizard
/studio/albums/[id]/edit   album editor
/studio/albums/[id]/clips  clip manager
/studio/upload             bulk uploader
/studio/releases           model/property releases + filming permits
/studio/earnings           earnings + ledger
/studio/payouts            payout requests + history
/studio/analytics          performance
/studio/profile            public storefront settings
/studio/tax                tax status, VAT number
```

---

## Album rules — enforce these in the UI

An album is **not a dumping ground**. Album coherence is the platform's moat and the biggest lever on refund rate:

- **Minimum 8 clips**, recommended 15–40, hard cap ~120
- **Single coherent theme** — "AlUla — Golden Hour Aerials" ✅ / "My best shots 2025" ❌
- **Consistent technical spec** — same or compatible resolution / fps / colour profile. Buyers cut albums into one timeline; mixing 24p LOG with 60p Rec.709 is a refund magnet. **Warn loudly at upload when specs are mixed.**
- **Consistent grade** — should cut together without regrading
- Cover clip + 3–6 hero stills

**Price bands by tier** (creator picks within the band — prevents a race to the bottom):

| Tier | Clips | Standard (SAR) | Extended |
|---|---|---|---|
| Mini | 8–14 | 299 | 897 |
| Standard | 15–34 | 799 | 2,397 |
| Pro | 35–69 | 1,799 | 5,397 |
| Signature | 70+ | 3,499 | 10,497 |

---

## The upload flow

```
Concept (title ar/en, description, category, location, theme)
  → Bulk upload clips (resumable, multi-GB, direct-to-S3 presigned)
  → Auto-extracted metadata (FFmpeg probe — never make creators type resolution/fps/codec)
  → Per-clip metadata review + tag suggestions
  → RELEASES & PERMITS — HARD GATE
  → Cover + trailer selection
  → Tier auto-assigned by clip count → price within band
  → Submit for review
```

### The releases gate — legally load-bearing

This is the part that gets platforms sued. Make it a **hard gate**, not a checkbox:

- **Model release** required for any identifiable person
- **Property release** for identifiable private property, interiors, artworks
- **Filming permit** — Saudi requires permits for commercial filming. Sites with their own authorities: **RCU (AlUla)**, **Diriyah Gate**, **NEOM**, **Red Sea Global**, the two Holy Mosques (extremely restricted), airports, military/government facilities. Capture the authority and permit reference number.
- Foreign creators (most of yours) are **likelier to have shot without a permit** — surface this prominently
- Albums with full documentation earn a **"مرخّصة للاستخدام التجاري ✅"** badge, which becomes a buyer-facing filter. Agencies filter on it exclusively.
- Editorial-use-only albums are flagged and **cannot** be sold under Extended licence

---

## Earnings and payouts

- Commission **frozen per OrderItem at purchase time** — never recompute from current rates
- Tiers: 35% → 30% (SAR 50k lifetime) → 25% (SAR 200k); **−5pt if album is exclusive**
- **30-day hold** after purchase before funds become available (covers refunds/chargebacks)
- Minimum payout SAR 500
- **Payout rails: Payoneer/Wise for Egyptian and other foreign creators; local IBAN for Saudi.** Egyptian creators cannot receive a Saudi IBAN transfer — this is required at launch, not later.
- Auto-generate a **self-billing invoice** per payout
- Withholding tax handling for non-residents (flag the field; tax logic pending advisor)

---

## Creator analytics — this is what retains creators

Not vanity metrics. Show:
- Which **search terms surfaced your clips**
- **Board-add rate** (buyers shortlisting you)
- Album page view → purchase conversion
- Revenue by album and period
- ★ **Demand signals** — "buyers searched for X in your locations and found nothing." This tells creators exactly what to shoot next and is the most valuable screen in the portal.

---

## Acceptance criteria

- [ ] Application → approval → agreement → studio access works end-to-end
- [ ] Resumable multi-GB upload survives a dropped connection
- [ ] Technical metadata auto-extracted, not typed
- [ ] Mixed-spec clips in one album trigger a visible warning
- [ ] Album cannot be submitted without releases resolved (attached or explicitly declared not-required)
- [ ] Ledger maths correct: commission frozen, 30-day hold enforced, balance accurate
- [ ] Payout request works for both Payoneer/Wise and IBAN
- [ ] Public storefront renders at `/creators/[handle]`
- [ ] Full Arabic RTL throughout

---

## Schema requests

Note needed fields here — **do not edit `schema.prisma`.**

---

## Explicitly NOT yours

Admin review queue (06 — you *submit* to it, they *action* it) · buyer checkout (04) · catalogue/search (05) · landing (02).
