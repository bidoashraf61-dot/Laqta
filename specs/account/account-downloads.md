# Download history

**Route** `/account/downloads` · **Access** any authenticated user · **Rendering** server component, dynamic

## Purpose
Audit trail of the user's own download redemptions — which album, which clip (or
whole-album ZIP), and when.

## Data in
- `requireUser()` for the session user id.
- `db.download.findMany`
  - filter: `{ userId: user.id }`
  - order: `createdAt` desc
  - **limit: `take: 200`** — older redemptions are silently not shown, with no
    pagination or "showing latest 200" notice
  - includes `entitlement.album.titleAr` and `clip.titleAr`.
- `Download` rows are written only by `app/api/download/route.ts` at redemption.
- `Download.ip`, `userAgent` and `bytes` are stored but not rendered here (they
  exist for admin abuse analysis). `bytes` is never populated by the local
  storage driver.

## Controls
Read-only. No links, buttons, filters or forms — a row does not link back to the
album or re-trigger the download.

| Control | Action | Effect |
| --- | --- | --- |
| — | — | None; the surface is read-only |

## States
- Empty: `EmptyState` with «لا توجد تحميلات بعد».
- Album-ZIP row (`isAlbumZip === true`): the clip cell shows
  «تحميل الألبوم كاملاً» instead of a clip title.
- Clip row with a deleted clip (`clipId` set but the relation resolves to null):
  clip cell shows `—`.
- Column header for the timestamp reuses `library.purchasedOn` («تاريخ الشراء»)
  even though the value is `Download.createdAt`, a redemption time.
- Loading/error: no route-level `loading.tsx` or `error.tsx`.

## Invariants
- This is a log, not a control surface: nothing here may create, edit or delete a
  `Download` row. The only writer is the download API route.
- Only the signed-in user's rows (`userId` filter). Downloads are unlimited by
  policy, so a high count is informational, never a block.

## Verified by
`verify:arabic`, `audit`.
