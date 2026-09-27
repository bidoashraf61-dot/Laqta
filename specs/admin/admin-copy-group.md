# Edit site copy

**Route** `/admin/content/copy/[group]` · **Access** admin only · **Rendering** server, dynamic (`auth()`); the editor is a client component (`components/admin/copy-editor.tsx`)

## Purpose
Edit every string a visitor reads, in Arabic and English, preview it on the real page,
publish, and undo any publish (DEV-64b: landing, `/sell`, emails; DEV-64c: every other
public, checkout and account surface).

`[group]` (`lib/copy-rules.ts#COPY_GROUPS` — each group lists top-level `messages` sections):

| Group | Sections | Strings | Preview opens |
| --- | --- | --- | --- |
| `landing` | `landing` (FAQ included) | 131 | `/` |
| `sell` | `sell` | 51 | `/sell` |
| `email` | `email` | 82 | the [email preview](admin-copy-email-preview.md) |
| `site` | `brand` (not `brand.name`), `nav`, `footer`, `search`, `legal`, `state`, `actions` | 75 | `/` |
| `catalogue` | `catalogue`, `commerce`, `count`, `media`, `review`, `request`, `sample` | 195 | `/albums` |
| `checkout` | `cart`, `checkout`, `promo` | 64 | `/cart` |
| `account` | `auth`, `account`, `library`, `boards` | 129 | `/account` |
| `contact` | `contact` | 39 | `/contact` |

Anything else is `notFound()`. **Not editable, by the owner's decision (2026-09-27):** the
admin and creator-studio interfaces — `dash.*`, `studio.*`, `admin.*`, `payoutRun.*`,
`security.*`, `role.*`, `palette.*` — and `brand.name` (the logo's text and accessible
name). `actions.*` and `state.*` are shared with the dashboards: an edit there shows in both.

## How edits are stored and read
- **`messages/*.json` is the default and is never modified.** An edit is a `CopyOverride`
  row (`key`, `locale`, `value`, unique per key+locale). No row = the JSON value.
- **Resolution inside `translate()`** (`lib/i18n.ts`): preview draft (admin preview render
  only) → published override → JSON → Arabic JSON.
  - Server components and actions: a process-wide map of published overrides, refreshed by
    `lib/copy-overrides.ts#refreshCopyOverrides` from `requestLocale()` at most every 15 s,
    and at once in the process that publishes. A failed read keeps the previous map.
  - Client components: `LocaleProvider` passes published + draft for the page's locale as
    context (`copy`); `useT()` hands it to `translate()`. Never a module global — two
    concurrent server renders must not share a preview.
  - Mail: `lib/outbox.ts#drain` refreshes the map before rendering, so an edit reaches mail
    already queued.
- **History:** every publish is a batch of `CopyRevision` rows (`batchId`, `key`, `locale`,
  `before`, `after`, `note`, `restoredFromBatchId`, `publishedAt`, `publishedById`).
  `null` = the JSON default. Append-only.

## Data in
- `groupKeys(group)` — every key of the group's sections, section by section, in JSON
  (page) order; `brand.name` excluded.
- For each key and language: the original (`defaultCopy`), the published override
  (`groupOverrides(prefix)`), the length cap (`lengthCap`) and the placeholders the original
  carries.
- `listCopyBatches(groupPrefixes(group))` — the 20 newest publishes touching the group,
  with publisher names; dates formatted server-side (`formatDateTime`). A batch's change
  list shows only this group's strings.
- For `email`: the template names (`emails/registry.ts#TEMPLATES`) for the preview picker.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Section heading (mixed groups) | — | «القوائم», «السلة», … (`dash.copy.section.*`) where a new part of the site begins; one-section groups show keys without the section name |
| «ابحث في النصوص» | client filter | matches the key, the current text or the original, either language |
| «المعدّلة فقط» (`aria-pressed`) | client filter | rows with a published edit or an unpublished change |
| Row — «العربية» / «الإنجليزية» textareas | edit | starts at what the site shows now; «الأصل: …» shows under the box whenever it differs from the original or is empty |
| Row — «إرجاع الأصل» | puts the original back in the box | shown only when the box differs from the original |
| «ما الذي تغيّر؟ (اختياري…)» | input, max 200 | the batch's `note` |
| Preview language «العربية / الإنجليزية» | toggle | which language the preview opens in |
| «الرسالة» (email only) | native select, templates by name (`dash.copy.template.*`) | which email the preview renders |
| «معاينة على الصفحة» / «معاينة رسالة» | `previewCopyAction(changes)` → new tab | stores the drafts (`CopyPreview`, validated like a publish, rows older than a day pruned) and opens `/?copyPreview=<id>` or `/sell?…` (`/en…` for English), or the [email preview](admin-copy-email-preview.md). Disabled while any row has an error |
| «تجاهل التعديلات» | native confirm | every box back to what the site shows; the stored draft cleared |
| «نشر» | native confirm → `publishCopyAction(changes, note)` | validates every change, writes the batch in one transaction, audits `copy.publish`, refreshes the published map, revalidates the whole site (`revalidatePath('/', 'layout')` — menus and footer are on every page). Disabled until something changed and while any row has an error |
| History — «التراجع عن هذا النشر» | native confirm → `undoCopyBatchAction(batchId)` | publishes a new batch that puts every string of that batch back to its `before` (an override or the original); audits `copy.restore` |
| History — «عرض التغييرات» | `<details>` | each string's before (struck) → after; `(الأصل)` marks the JSON default |

An empty box, or one equal to the original, publishes as **removing** the override.
All three actions refuse during view-as-user (`state.forbidden`).

## Edit rules (`lib/copy-rules.ts#validateCopy` — run live in the editor and again on the server)
- `{placeholders}` must match the original exactly — none dropped (`placeholderMissing`),
  none invented (`placeholderExtra`). The row lists them under «يجب أن يبقى».
- Length cap per string, from the original's length: ≤ 12 characters (a button or badge,
  «حفظ», «بحث») `max(len + 8, 2×)`; ≤ 40 `max(24, 1.6×)`; longer `2× + 40`. This is what
  keeps an edited button inside its button and a headline cut near its box. A live counter turns warning at
  90 %.
- No HTML tags.
- English box: not mostly Arabic. Arabic box: at least one Arabic letter when the original
  has one (Latin runs like «رقم IBAN» and «4K» are fine).
- No banned claim (`lib/copy-claims.ts`): the licence contradictions and overclaims
  (`verify:licence` — including, since DEV-21, ownership wording like «لك للأبد»,
  «امتلاك دائم», "yours for life": the buyer holds a permanent licence), refund copy and first/largest claims (owner decisions), and — email
  only — "filmed" and the bare words first/largest (`verify:mail`).
A publish with any failing string writes nothing; the refusal names the string, and the
editor scrolls to it and focuses it.

## States
- **Nothing edited** — every box shows the original; history says «لم يُنشر أي تعديل بعد…».
- **Row badges** — «معدّل» (a published override exists), «تعديل غير منشور» (the box
  differs from the site).
- **Row error** — red border, `aria-invalid`, the rule's message under the box; the publish
  bar says «صحّح النصوص المعلّمة بالأحمر قبل النشر.»
- **Unpublished changes** — «تعديلات غير منشورة: N»; the publish bar is sticky at the
  bottom. Leaving the tab asks first (`beforeunload`). The draft is kept in `localStorage`
  (`laqta:copy-draft:<group>`) and offered back on the next visit («استعادتها / تجاهلها»).
- **No search match** — «لا نصوص تطابق البحث.»
- **After publish / undo** — toast; the page refreshes and the editor remounts (keyed by the
  newest batch) clean from what is live.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Preview on the real page
`?copyPreview=<id>` is honoured by `middleware.ts` **only for a signed-in admin not viewing
as someone else**: it sets `x-laqta-copy-preview` (always overwritten, so a visitor cannot
send it). `requestLocale()` loads that preview's drafts into the render's draft holder (React
`cache()`, per render) and the root layout shows a warning bar «معاينة نصوص غير منشورة»
with «إنهاء المعاينة» (the same path without the query). Anyone else gets the published page.

## Invariants
- The JSON is the permanent fallback; a database failure or a removed override renders it.
- Only the groups above are editable; a key outside them (or `brand.name`) is refused at
  publish, at preview and when loaded.
- An edit can never blank a string: an empty box publishes as the original.
- A preview never leaks: drafts live per render on the server and per provider on the
  client.
- Every publish and undo is a new batch, audited; nothing is rewritten or deleted.

## Verified by
- `verify:copy` — every original of the three groups passes the rules in both languages;
  each refusal above; a batch with one bad string writes nothing and names it; a publish
  writes both strings, shows through `translate()` at once, leaves the other language alone,
  is recorded and audited; an unchanged string is "nothing"; an empty edit removes the
  override; undo restores as a new audited batch; a preview refuses what publish refuses,
  stores drafts, does not publish, and an unknown id loads nothing; an explicit (client) map
  wins; every published override still passes the rules. Plus (DEV-64c): admin/studio
  strings are not editable, every visitor surface is, `brand.name` is locked, no string is
  in two groups, a one-word button keeps a tight cap, a plural count keeps `{count}`.
- `verify:mail` — shares the banned patterns.
- `verify:arabic`, `audit` — `/admin/content/copy/landing` and `/admin/content/copy/catalogue`. `verify:arabic` skips textarea contents (a field's value is data being edited, and holds `{count}`-style placeholders by design).
- Not covered by a browser gate: the editor's controls and the preview banner.
