# Email preview

**Route** `/admin/content/copy/email/preview` · **Access** admin only · **Rendering** server, dynamic (`auth()`, `searchParams`)

## Purpose
Show one transactional email exactly as it would be sent, with sample data — with the
owner's unpublished edits when opened from the copy editor (DEV-64b).

Only `group = email` exists; `/admin/content/copy/<other>/preview` is `notFound()`.

## Data in
- `?template=` — one of `emails/registry.ts#TEMPLATES`; anything else → the first
  (`order.placed`).
- `?lang=` — `ar` | `en`; anything else → the admin's own language (so the page never mixes
  the two).
- `?copyPreview=<id>` — optional; the middleware honours it for admins only, and this RSC
  render then applies that preview's drafts (see [admin-copy-group.md](admin-copy-group.md)).
  Without it, the published copy renders.
- `renderTemplate(template, lang, SAMPLE_PAYLOAD)` — `emails/sample-payload.ts`, the same
  fixture `verify:mail` renders.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Back «الرسائل البريدية» | link | `/admin/content/copy/email` |

Read-only. The template and language are chosen in the editor before opening.

## States
- Title «معاينة الرسالة: {name}» uses the template's display name (`dash.copy.template.*`), not its code.
- Subject line above the message («الموضوع:»), isolated in `<bdi lang>`.
- The message in an `<iframe srcDoc sandbox="allow-same-origin">` — same origin so the
  site's fonts and logo load; no `allow-scripts`, so nothing in it runs. 70 dvh tall.
- The preview banner shows at the bottom when `copyPreview` is active.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Sample data only: nothing is sent, queued or written.

## Verified by
`verify:arabic`, `audit` (`/admin/content/copy/email/preview`, default template, admin's
language). Template rendering itself: `verify:mail`.
