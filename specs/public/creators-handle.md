# Creator profile

**Route** `/creators/[handle]` · **Access** public · **Rendering** server component, dynamic

## Purpose
One creator's public shelf: who they are and every live album they have.

## Data in
- `Creator` where `handle = params.handle` AND `status='approved'`. Selects `handle`, `displayNameAr/En`, `bioAr`, `city`, `country`.
- Nested `albums` where `status='live'`, ordered `publishedAt desc`, selecting `slug`, titles, `priceStandard`, `currency`, `clipCount`, `totalRuntimeS`, `clearedForCommercial`, `coverClipId`.
- Second query resolves cover posters from `Clip.thumbnailKeys[0]`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Album card | Link | `/albums/{handle}/{slug}` |

Read-only. There is no follow, contact or message control.

## States
- **Unknown handle or creator not approved** — `notFound()` → 404; metadata returns `state.notFound`.
- **Approved creator with no live albums** — the profile still renders (header, bio) with `EmptyState` beneath. Note the index page at `/creators` would not have linked here in that case.
- **No bio** — bio paragraph omitted.
- **No city** — the `city · ` prefix is dropped. `country` is selected but never rendered.
- **Avatar** — first character of `displayNameAr` in a circle; there is no avatar image.

## Invariants
- Only approved creators are reachable, and only their live albums are listed.
- Every card shows a price and carries `PreviewWatermark`.
- No earnings, balance or commission figure appears on this surface.

## Verified by
`verify:arabic` (via `/creators/yousef-shami`), `audit`.
