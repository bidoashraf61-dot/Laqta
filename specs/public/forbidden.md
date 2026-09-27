# Forbidden (403)

**Route** `/forbidden` · **Access** public (reached by rewrite, but directly addressable) · **Rendering** server component, static (no data, no async)

## Purpose
Tell a signed-in user that their role does not permit the URL they requested, without losing that URL.

## Data in
- None. Renders `state.forbidden` / `state.forbiddenHint` from the message dictionary.

- **Not indexed (DEV-33)** — `metadata.robots = { index: false, follow: false }`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "العودة للرئيسية" | Link | `/` |

Read-only.

## States
- **Reached by rewrite** — `middleware.ts` rewrites (not redirects) to this path when a signed-in user hits `/admin*` without the `admin` role, or `/studio*` without `creator`/`admin`. The address bar keeps the URL the user typed, so they can hand it to someone who does have the role.
- **Signed-out users never land here** — middleware redirects them to `/sign-in?callbackUrl=…` instead.
- **Directly addressable** — visiting `/forbidden` renders the same page with no context about what was refused; the page states no route, role or reason.
- Sits inside the `(public)` route group, so it carries the site header and footer, not the dashboard chrome.

## Invariants
- Must be a rewrite, not a redirect — a redirect would destroy the requested URL.
- Must not leak whether the requested resource exists.

## Verified by
`verify:arabic`. Not in the `audit` route list.

## Gate contract

The page root carries **`data-page="forbidden"`**, and that attribute — not the
title's wording — is what `verify:auth` and `verify:journeys` match. Both gates
used to match the literal «لا تملك صلاحية الوصول»; an editorial pass changed the
title, and the role-guard matrix reported three correctly blocked pages as
"allowed" while `verify:journeys` reported a correctly blocked `/admin` as
"ADMIN CONTENT LEAKED". Copy on this page is free to change. The marker is not.

Title `state.forbidden` «الوصول غير مسموح»; body `state.forbiddenHint`.
