# Boards

**Route** `/account/boards` · **Access** any authenticated user · **Rendering** server component, dynamic

## Purpose
The buyer's clip boards (client-facing shortlists): the list, a create form, and —
when arriving from a clip page — "add this clip to a board" (DEV-49).

## Data in
- `requireUser()` for the session user id.
- `db.board.findMany` where `userId`, `orderBy updatedAt desc`, with `_count.clips`; when
  `?add=<clipId>` is present, also each board's `BoardClip` row for that clip (to show
  which boards already hold it).
- `?add=<clipId>` → `db.clip.findFirst` where `id` and `album.status='live'` (title, slug).
  An unknown or non-live clip id is ignored — the page renders as without it.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| **Add panel** (only with a valid `?add=`) — one button per board, labelled with its name | `addClipToBoard(boardId, clipId)` (`ActionButton`) | Upserts the `BoardClip` row (adding twice is a no-op), touches `updatedAt`; toast «أضفنا اللقطة للوح.» A board that already holds the clip shows a «موجودة في «…»» badge instead of a button |
| Add panel → «اسم اللوح» + «لوح جديد بهذه اللقطة» | `createBoard` with hidden `addClipId` | Creates the board already holding the clip, then **redirects to `/account/boards/[id]`** (clears `?add=`, so a refresh cannot add twice) |
| Add panel → «ارجع للقطة» | Link | `/footage/{slug}` |
| Board name (card title) | Link | `/account/boards/[id]` ([spec](./account-boards-id.md)) |
| «لوح جديد» form (without `?add=`) — «اسم اللوح» | `createBoard` (`SettingsForm`) | Name required (≤80, «اكتب اسماً للوح.»); at most 50 boards per user («وصلت الحد الأعلى للألواح (50).»); redirects to the new board |

## States
- **Empty, no `?add=`** — `EmptyState` «ما عندك ألواح بعد» / «اجمع اللقطات في لوح، وشاركه مع فريقك أو عميلك.», then the create form.
- **Arriving from a clip** — the add panel leads the page («أضف «<clip title>» إلى لوح»); the separate create form is hidden (the panel has its own).
- Each card: name, `countOf('clip', n)`, and a «مشارَك برابط» (success) or «خاص» (neutral) badge.
- Errors from create render inline above the field (`SettingsForm`).

## Invariants
- Only the owner's boards (`userId`); every action re-checks ownership server-side (`app/(account)/account/boards/actions.ts`).
- Only a clip of a **live** album can be added.
- No money, no downloads. Boards are curation only and confer no entitlement — a clip on a board is not owned.
- Each board's clip count is `countOf('clip', n)` (DEV-22).

## Verified by
`verify:arabic`, `audit`; `verify:flows` (DEV-49) — as the seeded buyer: «أضف للوح» on a clip page → a new board holding the clip, share it, open the shared link signed out (200), remove the clip, delete the board.
