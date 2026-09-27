# Leave the waitlist

**Route** `/waitlist/unsubscribe?token=…` · **Access** public (the token is the key) · **Rendering** server component, dynamic, `noindex, nofollow`

## Purpose
Where the unsubscribe link in every waitlist email lands (DEV-45).

## Data in
- `?token=` — `WaitlistEntry.unsubscribeToken`. `?done=1` / `?invalid=1` after the POST.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «ألغِ الاشتراك» | POST `unsubscribe` (server action) → `unsubscribeByToken` | Sets `unsubscribedAt` (idempotent), redirects to `?done=1`; an unknown token → `?invalid=1` |

## States
- **Asking** — «إلغاء الاشتراك» + «تبغى تطلع من قائمة انتظار لقطة؟ ما راح نرسل لك رسائل عن الإطلاق بعدها.»
- **Done** — «طلعت من القائمة. ما راح نراسلك.»
- **Invalid / no token** — «هذا الرابط ما عاد يشتغل…» pointing at the contact page.

## Invariants
- Opening the link (a GET) changes nothing: mail scanners prefetch links.

## Verified by
`verify:mail` exercises `unsubscribeByToken`. The page itself is not in a browser gate.
