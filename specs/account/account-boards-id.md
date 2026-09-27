# Board

**Route** `/account/boards/[id]` · **Access** the board's owner (`requireUser` + `userId` filter; anyone else → 404) · **Rendering** server component, dynamic, `noindex`

## Purpose
One board (DEV-49): its clips, share by link on/off, rename, delete.

## Data in
- `db.board.findFirst` where `id` and `userId`, with `clips` (`orderBy addedAt desc`) → `clip` (the same `ClipHit` fields as `/boards/[token]`, price through `priceNow`).
- Clips whose album is not `live` stay on the board but are not shown (same rule as the public view).
- Share path: `localePath(locale, /boards/{shareToken})`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `BackLink` «ألواحي» | Link | `/account/boards` |
| «شارك برابط» (private board) | `setBoardPublic(id, true)` | `isPublic=true`; toast «اللوح صار مشاركاً برابط.» |
| «انسخ رابط المشاركة» (shared board, `CopyLink`) | clipboard | Copies `origin + share path`; toast «نسخنا الرابط»; falls back to a prompt if the clipboard is refused |
| «أوقف المشاركة» (shared board) | `setBoardPublic(id, false)` | `isPublic=false`; the token is kept, so sharing again restores the same link; toast «وقفنا مشاركة اللوح. الرابط ما يفتح الحين.» |
| «شيلها من اللوح» under each clip | `removeClipFromBoard(id, clipId)` | Deletes the `BoardClip` row; toast «شلنا اللقطة من اللوح.» |
| «اسم اللوح» + «حفظ الاسم» | `renameBoard(id)` | Name required, ≤80 |
| «احذف اللوح» (destructive, `window.confirm` «تحذف «…»؟ اللقطات نفسها ما تنحذف، بس اللوح ورابطه.») | `deleteBoard(id)` | Deletes the board and its rows; redirects to `/account/boards` |

## States
- **Empty board** — `EmptyState` «اللوح فاضي» / «افتح أي لقطة واضغط «أضف للوح».»
- Share section badge «مشارَك برابط» / «خاص», with «أي شخص عنده الرابط يقدر يشوف اللوح».
- Not the owner, or unknown id → 404.

## Invariants
- Every action re-reads ownership from the session.
- The public `/boards/[token]` answers only while `isPublic`.

## Verified by
`verify:flows` (share, remove, delete through this page), `audit` is not given a board id.
