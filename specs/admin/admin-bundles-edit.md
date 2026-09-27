# Create or edit a bundle

**Route** `/admin/bundles/new` · `/admin/bundles/[id]` · **Access** admin only · **Rendering** server, dynamic (`auth()`); the editor is a client component (`components/admin/bundle-editor.tsx`)

## Purpose
Build a bundle (DEV-62): which albums, the price (percentage off, or one fixed price),
dates, on/off — with a live panel showing, per album, what the buyer pays, what the creator
gets and what Laqta keeps.

## Data in
- `editorAlbums()` (`app/(admin)/admin/bundles/editor-data.ts`) — every live, priced album
  (newest first) with its price now (`priceNow`) and its commission rate, the numbers the
  ceiling is measured against.
- `[id]`: the `Bundle` with its album ids in `position` order; unknown id → 404.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «الاسم بالعربية» * / «الاسم بالإنجليزية» | inputs, max 80 | typing the English name fills «رابط الصفحة» until the link is edited by hand |
| «رابط الصفحة» * | input, slugified as typed | `/bundles/<slug>`; lower-case a–z, 0–9, hyphens, 3–60 |
| «الوصف بالعربية / بالإنجليزية (اختياري)» | textareas, max 600 | shown under the title on the public page |
| Selected albums (ordered list) | ✕ removes | order = order on the bundle page; an album over the ceiling is outlined red; one no longer live shows «ألبوم لم يعد منشوراً — أزِله لتحفظ.» |
| «أضف ألبوماً» search + list | click adds (up to 12) | filters by title or creator |
| «نسبة خصم» / «سعر ثابت للحزمة» | radio | `pricing` = `percent_off` / `fixed_price` |
| «نسبة الخصم (٪)» or «سعر الحزمة (دولار)» * | number | hint: the maximum % for these albums (Laqta's lowest share among them), or the separate total |
| «يبدأ» / «ينتهي» | `datetime-local` in the owner's clock, sent as instants | same fields and hints as the album offer editor |
| «الحزمة مفعّلة» | checkbox | `isActive` |
| «حفظ الحزمة» | `saveBundleAction(input)` → `lib/bundles.saveBundle` | disabled while an album is over the ceiling or no longer live. New bundle → full load of `/admin/bundles/[id]`; edit → refresh. Audits `bundle.create` / `bundle.update` with before/after; revalidates the site |

## The live panel «الحساب»
Below 2 albums: «اختر 2 ألبومات على الأقل لترى السعر.» Otherwise: «بشرائها منفصلة» struck,
«سعر الحزمة» in gold, «توفّر»; then a table «من يدفع الخصم — لكل ألبوم» — Album · Buyer pays
· Creator (unchanged by the bundle) · Laqta — a row in red when Laqta would keep less than
nothing; and «الخصم كله من حصة لقطة؛ حصة كل صانع كما لو بيع ألبومه منفرداً.» Computed with
`lib/bundle-pricing.ts`, the functions checkout runs.

## Rules at save (`saveBundle`; the first failure is shown in a destructive alert)
- Arabic name required; link valid and not used by another bundle.
- No banned wording in names or descriptions (`lib/copy-claims.ts`: licence overclaims,
  refunds, first/largest).
- 2–12 albums, all live and priced.
- `percent_off` 1–90; `fixed_price` > 0 and below the separate total; cents only.
- **Ceiling:** no album's share of the discount above Laqta's commission on it, at today's
  prices and rates («الخصم أكبر من حصة لقطة على N من الألبومات — لا يتجاوز M٪ لهذه الحزمة.»).
- End after start and in the future.

## Invariants
- The ceiling is re-checked at checkout (prices and rates change); a bundle over it is not
  applied, and `/admin/bundles` shows it as «غير متاحة».
- Saving replaces the album list in one transaction.

## Verified by
`verify:bundles` — every refusal above, a valid save audited, a taken link refused.
`verify:arabic`, `audit` (`/admin/bundles/new`).
