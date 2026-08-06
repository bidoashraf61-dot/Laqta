# Shared board

**Route** `/boards/[token]` · **Access** public, gated only by the unguessable share token · **Rendering** server component, dynamic

## Purpose
Let an agency send a shortlist to a client who has no account — the client reviews the clips, each still carrying its album and price.

## Data in
- `Board` where `shareToken = params.token` AND `isPublic = true`.
- `Board.user` → `name` (selected but never rendered).
- `BoardClip → Clip` selecting `id`, `slug`, titles, `durationS`, `width`, `height`, `fps`, `aspectRatio`, `thumbnailKeys`, `previewHlsKey`, and the parent `Album` (`slug`, `status`, titles, `priceStandard`, `currency`, `clipCount`, `clearedForCommercial`, `creator.handle`, `creator.displayNameAr`).
- Clips whose album is not `live` are filtered out in application code.
- `Clip.masterKey` is not selected.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Clip card | Link | `/footage/{slug}` |
| Clip card album ribbon | Link | `/albums/{creatorHandle}/{albumSlug}` |

Read-only. A viewer cannot comment, approve, add to the board, or buy from this page — nothing here mutates. There is no "add all to cart" control.

## States
- **Unknown token, or `isPublic=false`** — `notFound()` → 404. A private board is indistinguishable from a non-existent one.
- **Board with no live clips** — `EmptyState` with `state.empty`; the header (board name, count) still renders.
- **Count shown** — `hits.length` (live clips only), not the raw board size.
- **No expiry, no revocation UI** — the token is `Board.shareToken` (a cuid, `@unique`, `@default(cuid())`) and has no expiry field; access lasts until the owner flips `isPublic`.
- The board owner's name is fetched but not displayed.

## Invariants
- Sits in the `(public)` group deliberately: requiring a client to sign up to view a shortlist kills the agency workflow.
- Every clip still carries its album ribbon and price — the person viewing this is the person approving the spend.
- Only clips from `live` albums are shown.
- Every thumbnail carries `PreviewWatermark`.
- `masterKey` is never referenced.

## Verified by
Not covered — no gate visits `/boards/[token]`.
