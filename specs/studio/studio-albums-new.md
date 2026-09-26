# New album

**Route** `/studio/albums/new` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic (session-gated; reads `PriceBand`)

## Purpose
Create a draft album from a title, an optional description and a price band.
Nothing else — clips are added later, on the album's own page.

## Data in
- `PriceBand.findMany` ordered by `priceStandard asc` — renders one radio card per band with `labelAr`, `minClips`–`maxClips`, `priceStandard`, `currency`.

## Controls
| Control | Action | Effect |
|---|---|---|
| Form (`SettingsForm`) → «إنشاء» | `createAlbum` server action | Creates `Album` with `status: 'draft'` and `licenceVersionId` = the current licence, writes `AuditLog` `album.create`, revalidates `/studio/albums`, then `redirect('/studio/albums/{id}')` |
| `titleAr` (required, ≤120) | form field | `Album.titleAr` |
| `titleEn` (required, ≤120, `dir="ltr"`) | form field | `Album.titleEn`; also the source of the ASCII `slug` |
| `descriptionAr` / `descriptionEn` (≤1000) | form fields | Stored, or `null` when blank |
| Band radios `mini / standard / pro / signature` | form field `tier`, defaults to `standard` | Selects the `PriceBand`; **price is not a field** |

## States
- **Validation failure** — the action returns `{ ok:false, message }` and `SettingsForm` renders a destructive alert above the fields: missing `titleAr` (`studio.titleArRequired`), missing `titleEn` (`studio.titleEnRequired`), tier not in the enum or band row missing (`state.error`).
- **Pending** — the submit button disables and shows a spinner (`useFormStatus`).
- **Success** — no success alert is seen: the action redirects straight to the new album page.
- **Slug collision** — `slugify(titleEn)` is suffixed `-2`, `-3`, … in a loop until `Album.slug` is free; an empty ASCII slug (e.g. an all-Arabic English title) falls back to `album`.
- **No bands seeded** — `PriceBand` empty renders a tier field with no options and the action fails with `state.error`. Not handled explicitly.
- **No creator profile** → `redirect('/sell')`.

## Invariants
- The creator never types a price. `priceStandard` is copied from the chosen `PriceBand`; `priceExtended = priceStandard × band.extendedMultiplier`; `currency` comes from the band. One price per size of album, no undercutting.
- The bands are edited on `/admin/catalogue` (add, edit, delete; audited). A band edit changes only what this page offers and copies from then on — an album already created keeps its price. A deleted band's tier disappears from the radios.
- New albums are always created `status: 'draft'` — this route cannot publish.
- **Every album carries a licence from creation** (`lib/licence.currentLicenceId()`, DEV-06). Albums made here once had none and sold with a blank licence.
- The action re-resolves the creator from the session; `creatorId` is never taken from the form.

## Verified by
`verify:arabic`, `audit`. The create action itself is not exercised by `verify:flows`.
