# Spec D — Content control (admin as CMS)

**Status** approved 2026-08-20; **64a built 2026-09-27** (long-form pages) and **64b built 2026-09-27** (landing, `/sell`, FAQ, email copy) — see below; 64c (every other string) not built · **Order** fourth (A → C → B → D) · **Largest of the four**

## Purpose

Today roughly 80% of what a visitor reads is unreachable from the admin panel.
929 UI strings live in `messages/*.json`, every legal page is a code constant,
the seasonal shelf is a hardcoded array, and album prices have no editor.
Changing a single word requires a developer, a build and a deploy.

This spec makes the admin dashboard a content management system: the operator
controls every word, every price, every legal page and every scheduling
decision, without code.

## The decision, and its stated cost

The operator was offered a boundary — long-form *content* editable, interface
*labels* left in code because they carry layout constraints and gate coverage —
and **chose no boundary**: all 929 strings become editable.

That decision is recorded as made with the risk stated. It is not revisited
here. Instead the risk becomes the design problem this spec solves: an editable
string is a string that can be blanked, overrun its container, lose a variable,
or break RTL — and a database value bypasses `verify:arabic`, `verify:leading`
and `verify:contrast`, which only ever inspected code.

**Everything in "Safety" below exists because of that choice.** Without it this
spec is three screens; with it, it is a content platform.

## Architecture

### Layering, not replacement

`messages/ar.json` and `messages/en.json` **stay in the repository** and become
the **default layer**. They are the seed, the fallback, and the thing a fresh
deployment renders before anyone has edited anything.

Overrides live in the database on top:

```
model CopyOverride {
  id         String   @id @default(cuid())
  key        String                  // 'landing.heroBold'
  locale     String                  // 'ar' | 'en'
  value      String
  status     CmsStatus @default(draft)
  updatedBy  String
  updatedAt  DateTime @updatedAt

  @@unique([key, locale, status])
  @@index([status])
}

model CopyRevision {
  id         String   @id @default(cuid())
  key        String
  locale     String
  value      String
  publishedAt DateTime @default(now())
  publishedBy String

  @@index([key, locale, publishedAt])
}
```

Resolution order at render: **published override → JSON default**. A missing or
blank override is not an empty string; it is the original. This is what makes
"delete all the text" a survivable mistake rather than a broken homepage.

`translate(locale, key)` in `lib/i18n.ts` is the single choke point every string
already passes through, so the lookup changes in one function and every surface
inherits it.

### Caching — the thing that would otherwise sink this

929 keys read from the database on every render would be catastrophic. The
override map is fetched **once** and cached with a tag:

- One query returning all published overrides, cached under `copy` and
  `copy:<locale>`.
- Publishing revalidates the tag. Nothing else invalidates it.
- The RSC render reads from the cached map synchronously, exactly as it reads
  the JSON today.

If the cache read fails, the JSON default renders. Copy is never a reason for a
page to fail.

### What 64a actually built (2026-09-27) — differs from this spec

- **A dedicated `DocumentVersion` model, not `CmsEntry`.** A page is a list of sections
  (heading, paragraphs, bullet list — each in Arabic and English); `CmsEntry` is a title
  and one body, so storing sections there would have meant JSON inside a text column.
  `CmsEntry` stays unused, left for blog/help.
- **Append-only versions, no draft rows.** Publishing writes a row; the newest row is live;
  a restore writes a copy. The unpublished draft lives in the editor (and the browser's
  storage between visits), with a live preview that renders the real page component —
  so there is no separate "preview the site with drafts applied" mode for documents.
- **Publish-time gates** are `lib/editable-documents.ts#validateSections` (structure, lengths, no
  HTML, no Arabic pasted into English) plus the banned-claim list from `verify:licence`,
  now shared in `lib/copy-claims.ts`. No override: the owner rewords instead.
- Admin routes: `/admin/content` (list) and `/admin/content/[key]` (editor) — not
  `/admin/content/documents`; 64c's string editor will need its own route.
- Specs: `specs/admin/admin-content.md`, `specs/admin/admin-content-key.md`.

### What 64b actually built (2026-09-27) — differs from this spec

- **`CopyOverride` holds only published values** (unique key+locale, no `status`);
  history is `CopyRevision` rows grouped by `batchId` with `before`/`after`, so "revert"
  is **undo a whole publish** (a new batch), plus per-string «إرجاع الأصل» in the editor.
- **Drafts** live in the editor (and browser storage). **Preview** stores them in
  `CopyPreview` and opens the real page with `?copyPreview=<id>`; the middleware honours it
  for admins only and the drafts apply per render (React `cache()`) — never globally.
- **Caching:** a per-process map refreshed from `requestLocale()` at most every 15 s
  (no Next cache tag); client components receive their locale's map by context.
- **Save-time validation** as specified (placeholders, length class, no HTML, direction,
  banned claims) in `lib/copy-rules.ts`, run in the browser and on the server. The length
  class is derived from the original's length, not hand-classified per key. There is **no
  override-with-confirmation** of a failing rule, and `verify:leading` / `verify:contrast`
  do not measure staged copy — the length cap stands in for them.
- Scope: `landing.*` (incl. FAQ), `sell.*`, `email.*`. Routes: `/admin/content` (hub),
  `/admin/content/copy/[group]`, `/admin/content/copy/email/preview`.
  Specs: `specs/admin/admin-copy-group.md`, `admin-copy-email-preview.md`.

### `CmsEntry` — connected, finally

`CmsEntry` already has kinds `legal`, `landing_copy`, `blog_post` and
`help_article` and **no public page reads it**. It becomes the store for
long-form documents:

- **Legal pages.** `TERMS` and its siblings are code constants today. They move
  to `CmsEntry` with a published/draft state and an effective-from date, so a
  policy change is an edit, and the previous version stays readable — which is
  what "these terms took effect on X" requires.
- **Help articles and blog posts.** The kinds exist; the routes do not. Out of
  scope here except that the model is left able to carry them.

The waitlist rows currently squatting in `CmsEntry` as `landing_copy` /
`waitlist:<email>` are migrated to the `WaitlistSignup` model created in Spec C.

### `MerchandisingSlot` — deleted

Written by `/admin/merchandising`, read by no public page. It duplicates what
featuring an album and the seasonal shelf already do. It is removed rather than
wired, along with its admin screen, so nothing pretends to schedule a promotion
that will never render.

### `PromoCode` — connected

Created, edited and toggled by admin today; never read by checkout. `lib/orders.ts`
gains discount resolution:

- A code field in the cart and at checkout.
- Validation: exists, active, in date, under its usage cap, meets any minimum.
- The discount is applied **before VAT**, and the resolved amount is **frozen on
  the order** exactly as the price and commission are. A code edited or disabled
  later never changes a completed order.
- Creator commission is calculated on the **net after discount**, so a promotion
  is not silently funded by the creator. This is a policy decision the spec
  makes explicit rather than leaving to the arithmetic.

### Configuration becomes data

| Today | Becomes |
|---|---|
| `SEASONS` array in `lib/season.ts` | `Season` table — slug, labels, Hijri or Gregorian window, active |
| `VAT_RATE` env var | Tax rule per buyer country (shape pending the accountant) |
| `MIN_PAYOUT_USD = 100` | Editable operating constant |
| Commission tier thresholds | Editable, with the freeze-at-purchase invariant untouched |
| Review SLA hours | Editable |
| Nav, footer and social links (`lib/brand.ts`) | Editable link sets |
| Price bands | Editor — specified in Spec C, referenced here |

`/admin/settings` stops being read-only by design and becomes the screen where
these live. Anything genuinely structural stays code and says so on the page.

## Safety

Every item here exists because the boundary was declined.

**Save-time validation.** A save is refused, with a specific message, when it:
- removes a placeholder the default contains — `{count}`, `{album}`, `{creator}`
- exceeds the length class for that key (see below)
- contains HTML or script
- is blank *and* the caller expects text — blank means "use the default", and
  the UI says so rather than letting it look like deletion

**Length classes.** Each key is classified once, from its call site: `label`
(button, nav, badge), `line` (heading, hint), `body` (paragraph, FAQ answer),
`document` (legal). A `label` gets a hard character cap tuned to its container.
This is how a button survives being editable.

**Draft → preview → publish.** Edits are drafts. Preview renders the real page
with drafts applied, visible only to the operator. Publishing promotes drafts
and revalidates the cache.

**Gates run against staged content.** This is the part that replaces what code
review used to do. On publish, the staged values are checked by the same rules
the build gates enforce:
- `verify:arabic` — no English in an Arabic value, no Arabic in an English one
- `verify:leading` / `verify:contrast` — a preview render is measured, so a
  headline that now wraps into itself is caught before it publishes
- placeholder and length validation as above

A failing check blocks the publish and names the offending key. The operator can
override with an explicit confirmation, which is audited — because a hard block
on your own website is its own kind of trap.

**Revision history.** Every publish writes a `CopyRevision`. Any key can be
reverted to a previous value, or to the JSON default, in one action.

**Audit.** Every publish and revert is written to the audit log with the
operator, the keys touched and the count.

## The admin screens

1. **`/admin/content`** — every key, grouped by section (`landing`, `catalogue`,
   `commerce`, …), searchable by key or by text in either language. Shows
   default vs override, highlights what is overridden, and edits both languages
   side by side.
2. **`/admin/content/documents`** — legal pages and long-form entries, with
   effective-from dates and version history.
3. **`/admin/settings`** — operating constants, seasons, links, price bands.
4. **`/admin/promos`** — unchanged, but the codes now work.

## States

- **No overrides at all** — the site renders exactly as it does today from JSON.
- **Override blank** — default renders; the row is shown as "using default".
- **Draft exists, nothing published** — public sees the previous published value
  or the default; the operator sees the draft in preview.
- **Cache stale after publish** — impossible by construction; publish
  revalidates the tag in the same action.
- **A key exists in the database but no longer in the code** — shown as orphaned
  and offered for deletion. Renaming a key in code must not leave an invisible
  override behind.

## Invariants

1. **The JSON default is never deleted and is always the fallback.** A database
   failure, a blank value or a missing key renders the original text.
2. **Copy never breaks a page.** No render fails because of content.
3. **Placeholders survive editing.** A value missing a required variable cannot
   be saved.
4. **A published discount is frozen on the order**, alongside the frozen price
   and commission. Editing a promo never changes a completed order.
5. **Commission is calculated after discount**, so a promotion is not funded by
   the creator without saying so.
6. **Every publish is reversible and audited.**
7. **Interface labels remain length-bounded.** Editable does not mean unbounded.

## Verified by

- `verify:copy` (new) — every key resolves in both languages, placeholders match
  the default, length classes hold, and the fallback renders when an override is
  blank or the database is unreachable.
- `verify:arabic`, `verify:leading`, `verify:contrast` extended to run against
  **staged overrides** as well as the JSON, since content is no longer only in
  code.
- `verify:money` extended: a discount is frozen on the order, a refund reverses
  at the frozen discounted amount, and commission is computed after discount.
- `verify:flows`: publish, preview and revert each mutate and navigate.
- `audit` covers the new admin routes at both widths.
- Specs updated in the same change: `specs/admin/README.md` route table and dead
  ends — this spec closes the promo dead end and removes the merchandising one
  by deleting the feature.

## Deliberately not in scope

Page layout and section order as data — the design system is code, and a
drag-and-drop page builder is a different product. Blog and help article
*routes*, though the model supports them. Translation workflow beyond editing
both languages side by side.

## Open

- **Tax rule shape** waits on the accountant, as in the invoicing decision.
- **Length caps per key class** need one pass over the call sites to set
  sensibly; the classification is mechanical but the numbers are judgement.
