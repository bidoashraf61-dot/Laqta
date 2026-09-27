# Sell your footage

**Route** `/sell` · **Access** public · **Rendering** server component, dynamic (two count queries)

## Purpose
Recruit creators: lead with their revenue share, then answer the two objections that stop a signup — "do I lose my rights" and "will you change the rate later".

## Data in
- `Clip.count()` where `album.status='live'`.
- `Creator.count()` where `status='approved'`.
- Constants from `lib/commission.ts`: `TIER_RATES` (standard/silver/gold platform rate; the page shows `1 - rate` as the creator share), `TIER_THRESHOLDS_USD` (silver 12,500 · gold 50,000), `EXCLUSIVE_BONUS_POINTS` (0.05).
- All copy from `messages/*.json` under `sell.*`, through `translate()` — so any string the owner edited at [`/admin/content/copy/sell`](../admin/admin-copy-group.md) (DEV-64b) shows instead, and an admin's `?copyPreview=<id>` shows unpublished drafts under a preview banner.

## Pricing copy
How-it-works step 2 (`sell.how2Body`) reads «ارفع اللقطات، وسمِّ الألبوم، واملأ تفاصيله: مولّدة أو مصوّرة، وموقعها وتصنيفها، وأرفق التصاريح.» — true since the album details form (DEV-08).
The FAQ «مين يحدد السعر؟» answers «تحدّده لقطة عند المراجعة، بين {min} و{max} دولار، مسترشدةً بعدد لقطات الألبوم ودقته ونوعه وجودته.» (`sell.faq3A`), with `{min}`/`{max}` read from the owner's pricing settings (`lib/pricing-config`, DEV-09c) — the page cannot drift from the range the review page enforces.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «قدّم كصانع محتوى» (`sell.apply`, ×2, hero and closing band) | Link | `/contact?topic=selling` — the contact form opens with «البيع على لقطة» preselected. There is no self-serve creator sign-up: the owner recruits, then opens the studio from `/admin/users/[id]` (DEV-05) |
| «تصفّح المكتبة أولاً» (`sell.browseFirst`) | Link | `/albums` |
| Content-policy link | Link | `/content-policy` |

Read-only — no form, no server action on this page. The application itself happens at `/sign-up`.

## States
- **Empty catalogue** — the counts render as «لا لقطات · لا صنّاع محتوى» (EN "0 clips · 0 creators"); there is no conditional hiding of the trust line.
- **Tier threshold display** — `standard` (threshold 0) shows the tier label instead of a threshold figure.
- **Currency** — thresholds come from `TIER_THRESHOLDS_USD` and render with `formatMoney` in USD, the same currency as prices and payouts.
- **Also the creator-funnel entry point** — `/studio` redirects here when a signed-in user has no creator profile, so this page is reached mid-funnel as well as cold.

## Invariants
- The trust line under the hero is `countOf('clip', clips) · countOf('creator', creators)` — «٣ صنّاع محتوى», not «٣ صانع محتوى» (DEV-22).
- The album size stated on this page (`sell.whatWeNeed2`, `sell.how1Body`) is **30 to 70 clips around one subject** — the same range the studio submission gate enforces and the landing promises to buyers. Change all three together.
- Creator-facing copy asks for **rights, not a production method**: «مادة سعودية
  تملك حقوقها كاملة، مع الإفصاح عن طريقة إنتاجها». It previously required footage
  *shot* inside the Kingdom, which excluded the route the product actually
  accepts, and then named the generated route explicitly, which put the
  production method in acquisition marketing. Ownership is the condition that
  matters; disclosure is enforced by the content policy at review.
- The stated commission model must match `lib/commission.ts`; the page reads the constants rather than hard-coding percentages.
- The "frozen rate" promise on this page is the same invariant enforced in `lib/orders.ts` — commission is resolved once at purchase and a later tier promotion never applies retroactively.
- No individual creator's earnings are shown.

## Verified by
`verify:copy` (the edit layer and its rules). `verify:arabic`, `audit`. The commission arithmetic behind the numbers is covered by `verify:money`.
