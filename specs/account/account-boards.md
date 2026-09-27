# Boards

**Route** `/account/boards` · **Access** any authenticated user · **Rendering** server component, dynamic

## Purpose
Lists the user's clip boards (client-facing shortlists) with a clip count and a
public/private indicator.

## Data in
- `requireUser()` for the session user id.
- `db.board.findMany`
  - filter: `{ userId: user.id }`
  - order: `updatedAt` desc, no limit
  - includes `_count: { clips: true }` (`BoardClip` join rows).
- `Board.shareToken` is read to build the public link.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «مشاركة» badge (public boards only) | `<Link href="/boards/{board.shareToken}">` | Opens the public board page `app/(public)/boards/[token]/page.tsx` |
| «مشاركة عبر رابط» badge (private boards) | none | **Not a control.** A plain `<Badge>` with no handler — it reads as a "make public" affordance but does nothing |

There is **no create, rename, delete, reorder, remove-clip or visibility-toggle
control on this page, and no `actions.ts` in this route folder.** Boards can only
be created and populated by seed data or direct database writes.

## States
- Empty: `EmptyState` with «لا توجد ألواح» / «اجمع اللقطات في لوح وشاركه مع عميلك»
  — and no CTA, because there is no create action to point at.
- Public board: success badge that links out. Private board: neutral, inert badge.
- Loading/error: no route-level `loading.tsx` or `error.tsx`.
- **Not wired:** the footage detail page links «أضف إلى لوح» to
  `/account/boards?add=<clipId>` (`app/(public)/footage/[slug]/page.tsx`). This
  page never reads `searchParams` — the `add` parameter is ignored and no clip is
  added. The add-to-board flow is a dead end.

## Invariants
- Each board's clip count is `countOf('clip', n)` — plain text, no longer an LTR `.numeric` line, which set Arabic words left-to-right (DEV-22).
- Only the owner's boards (`userId` filter).
- A board is only reachable by share token when `isPublic` is true; the private
  branch must never render the `/boards/{shareToken}` link.
- No money, no downloads. Boards are curation only and confer no entitlement — a
  clip on a board is not owned.

## Verified by
`verify:arabic`, `audit`. **Not covered by `verify:flows`** — that gate only
exercises studio and admin controls, and this page has no working controls to
exercise.
