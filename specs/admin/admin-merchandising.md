# Merchandising

**Route** `/admin/merchandising` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
Edit the storefront without a deploy: homepage slot copy, media, link and scheduling
window, plus publish/feature toggles on collections.

## Data in
- `MerchandisingSlot.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] })` — all
  slots, no filter, no limit.
- `Collection.findMany({ orderBy: [{ sortOrder: 'asc' }, { titleAr: 'asc' }] })` with
  `_count.albums`.
- `now` is computed in the page to decide whether a slot is inside its window.

Takes no `searchParams`; there is no search or filter on this route.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Slot activate / deactivate button | `toggleSlotActive(id, !isActive)` | flips `MerchandisingSlot.isActive`; revalidates `/admin/merchandising` and `/` |
| «تعديل» on a slot | opens `SlotEditor` | — |
| Slot form → save | `saveSlot` (`SettingsForm`) | writes `titleAr/En`, `subtitleAr/En`, `ctaLabelAr/En`, `linkUrl`, `mediaUrl`, `sortOrder`, `startsAt`, `endsAt`. Audits `slot.update` (or `slot.create`). Revalidates `/admin/merchandising` and `/` |
| Collection «نشر» toggle | `toggleCollection(id,'isPublished',!v)` | flips `Collection.isPublished`; revalidates `/admin/merchandising` and `/collections` |
| Collection «تمييز» toggle | `toggleCollection(id,'isFeatured',!v)` | flips `Collection.isFeatured`; same revalidation |
| Collection title | link | → `/collections/{slug}` |

## States
- **No slots** — `EmptyState` with `dash.noSlots`.
- **No collections** — `EmptyState` with `state.empty`.
- **Slot badge is three-valued**: active *and* inside its window → `dash.slotActive`
  (success); active but outside the window → `dash.slotWindow`; not active →
  `dash.slotInactive`. "Active" alone would read as "showing", which it is not.
- **Slot with no `titleAr`** — the row falls back to displaying its `key`.
- **`saveSlot` with neither `id` nor `key`** → `{ ok: false, message: state.error }`.
- **Create path is unreachable from the UI.** `saveSlot` supports creating a slot when
  `key` is supplied and `id` is not, but no control on this page submits a `key` — the
  `SlotEditor` always posts a hidden `id`. New slots must be seeded or inserted directly.
- **Collection content is not editable here** — title, slug, hero media, description,
  sort order and album membership have no editor; only the two booleans are reachable.
- **Media is a URL field, not an upload.** `mediaUrl` is free text; there is no file
  picker and cloud storage is not wired (see `/admin/settings`).
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- No money, no entitlement, no catalogue state. This surface only affects presentation.
- Every mutation revalidates the public surface it feeds (`/` or `/collections`) as well
  as itself, so an operator's change is visible on the storefront without a deploy.
- Every mutation writes an `AuditLog` row.

## Verified by
`verify:arabic`, `audit`. Not covered by `verify:flows` (the route has no filter chips).
