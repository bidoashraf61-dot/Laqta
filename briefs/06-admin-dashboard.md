# Brief 06 — Admin Dashboard

**Branch:** `feat/admin` · **Depends on:** Brief 01 (Foundation) merged; ideally 03 (Creator Portal) too
**Owns:** `app/[locale]/(admin)/admin/*`, `components/admin/*`

---

## Context

**Laqta (لقطة)** — Arabic-first stock-footage marketplace. Creators upload **albums**; buyers purchase them once and own them forever. Platform takes a commission. Egypt-registered company, Saudi buyers, Egyptian creators at launch.

Read `briefs/00-README-START-HERE.md` first.

**This is the operational heart of the business.** Every album passes through here before it reaches a buyer. Admin is internal-only — it can be English-first, but Arabic content must display correctly (RTL text blocks inside an LTR shell).

---

## Routes you own

```
/admin                    overview: GMV, orders, queue depth, alerts
/admin/queue              ★ content review queue — the most important screen
/admin/queue/[albumId]    album review workspace
/admin/catalogue          all albums/clips, bulk edit, feature/unfeature, delist
/admin/creators           applications, approvals, tiers, commission overrides
/admin/orders             orders, refunds, chargebacks, manual invoices
/admin/payouts            payout runs, approvals, bank/Payoneer export
/admin/merchandising      homepage, collections, featured albums, banners
/admin/taxonomy           categories, locations, tags, ar↔en synonyms
/admin/pricing            price bands, promo codes, bundles
/admin/disputes           DMCA / IP claims / takedowns
/admin/reports            GMV, take rate, refund rate, zero-result queries, leaderboard
/admin/users              buyer accounts, support impersonation (audited)
/admin/cms                blog, help centre, landing copy
```

---

## ★ The review queue — build this first

Every album is reviewed before going live. This screen determines catalogue quality, legal exposure and refund rate. **Target SLA: 3 business days.**

**Review workspace needs:**
- Play every clip inline (watermarked previews)
- Side-by-side metadata in Arabic and English
- Attached releases and permits, with the issuing authority visible
- Duplicate/re-upload detection (perceptual hash) — flags stolen or re-listed content
- Technical consistency report across the album
- Decision: **Approve** / **Request changes** (with note to creator) / **Reject**

**Reviewer checklist — implement as an actual checklist, not prose:**

| Check | Why it matters |
|---|---|
| Technical consistency | Mixed 24p LOG + 60p Rec.709 in one album is a refund magnet |
| Duplicate detection | Stolen or re-listed footage |
| Metadata accuracy, **both languages** | Search quality depends on it |
| **Releases & permits complete** | Legal exposure — see below |
| Album coherence | One theme, not a dumping ground |
| Quality bar | The catalogue's reputation |
| **Cultural & regulatory appropriateness** | Saudi decency/content standards (GCAM) |
| No third-party logos / IP | Licensing risk |

### Permits — where legal risk actually lives

Saudi requires permits for commercial filming. Sites with their own authorities: **RCU (AlUla)**, **Diriyah Gate**, **NEOM**, **Red Sea Global**, the two Holy Mosques (extremely restricted), airports, military/government facilities.

**Creators are mostly foreign (Egyptian) and are likelier to have shot without a permit.** Manual permit verification for foreign creators is non-negotiable. Albums with full documentation get the **"cleared for commercial use ✅"** badge — which becomes a buyer-facing filter that agencies rely on.

---

## Orders, refunds, payouts

- Order list, detail, refund (full/partial), chargeback handling, manual invoice
- **Refund policy:** none after download; 7-day window if undownloaded; discretionary for technical defects
- Payout runs: approve, export bank file (IBAN) **and Payoneer/Wise** for foreign creators
- Commission overrides per creator
- **Never recompute commission from current rates** — it's frozen per OrderItem at purchase

## Reports that matter
- GMV, take rate, AOV, refund rate, repeat-purchase at 90 days
- **★ Zero-result search queries** — the single most valuable report. It is your content-acquisition roadmap and feeds creator demand signals.
- Clip→album PDP CTR, PDP→purchase conversion
- Creator leaderboard, review SLA adherence
- Clips per Saudi location — shows catalogue holes

---

## Acceptance criteria

- [ ] Review queue: play clips, inspect releases, run full checklist, approve/reject with note
- [ ] Rejection notifies the creator with the reason and reopens the album for edit
- [ ] Duplicate detection flags a re-uploaded clip
- [ ] Approval publishes the album and indexes it in search
- [ ] Order refund adjusts creator ledger correctly (reverses the frozen commission)
- [ ] Payout run exports a valid file for both IBAN and Payoneer/Wise
- [ ] Taxonomy editor manages ar↔en synonyms used by search
- [ ] Merchandising changes appear on the landing page
- [ ] Zero-result query report renders
- [ ] Admin routes blocked for non-admin roles; impersonation is audit-logged
- [ ] Arabic content displays correctly inside the admin shell

---

## Schema requests

Note needed fields here — **do not edit `schema.prisma`.**

---

## Explicitly NOT yours

Creator studio (03 — they submit, you action) · buyer checkout (04) · catalogue/search (05) · landing (02).
