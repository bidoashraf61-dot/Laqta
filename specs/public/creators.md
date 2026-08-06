# Creator index

**Route** `/creators` · **Access** public · **Rendering** server component, dynamic

## Purpose
List the approved creators who have at least one live album.

## Data in
- `Creator` where `status='approved'` AND `albums: { some: { status: 'live' } }`, ordered `lifetimeGmv desc, createdAt asc`.
- Selects `handle`, `displayNameAr`, `displayNameEn`, `bioAr`, `city`, `_count.albums`.
- No take limit — the whole approved-with-live-work set.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Creator card | Link | `/creators/{handle}` |

Read-only.

## States
- **No qualifying creators** — `EmptyState` with `state.empty`.
- **No bio** — the bio paragraph is omitted.
- **No city** — the `city · ` prefix is dropped.
- **Avatar** — there is no avatar image field in use; the tile renders the first character of `displayNameAr` in a circle.
- The album count is `_count.albums`, i.e. **all** of the creator's albums including drafts, not only live ones — so it can exceed what `/creators/{handle}` displays.
- Ordering exposes `lifetimeGmv` indirectly (highest-earning creator first) but the figure itself is never rendered.

## Invariants
- Only `status='approved'` creators appear, and only those with at least one live album.
- No financial figure (`lifetimeGmv`, balances) is rendered on a public surface.

## Verified by
`verify:arabic`, `audit`.
