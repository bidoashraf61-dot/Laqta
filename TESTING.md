# Testing Laqta

Everything you need to verify this portal, assuming **no prior context**.

## TL;DR

```bash
npm run db:start          # embedded Postgres on :5433 (once per machine boot)
npm run db:seed           # demo catalogue, users, 90 days of analytics
npm run build && npm start &   # the browser gates need a real server
npm run test              # ← runs everything
```

`npm run test` is the whole suite. It exits non-zero on the first failure and
names the failing check.

## Accounts the tests use

Seeded by `npm run db:seed`. Password for all three: `Laqta!2026`

| Email | Role | Sees |
|---|---|---|
| `buyer@agency.sa` | buyer | catalogue, cart, checkout, library |
| `creator@laqta.sa` | creator | the studio (`/studio/*`) |
| `admin@laqta.sa` | admin | the control panel (`/admin/*`) |

An admin has **no creator profile**, so `/studio` redirects it to `/sell`. Use
the creator account for the studio — testing the studio as admin measures a
marketing page.

## The layers

Each answers a different question. A green run of one proves nothing about the
others, which is why they all exist.

| Command | Question it answers | Needs a server? |
|---|---|---|
| `npm run test:unit` | Is the pure logic right? | no |
| `npm run verify:migrations` | Does a fresh `migrate deploy` build the schema the app uses? | no (db only; creates and drops a throwaway database) |
| `npm run verify:i18n` | Is the copy complete and correctly formatted? | no |
| `npm run verify:search` | Does Arabic search fold and match? | no (db only) |
| `npm run verify:entitlement` | Does "buy once, own forever" hold? | no (db only) |
| `npm run verify:money` | Is commission frozen; do refunds reverse correctly? | no (db only) |
| `npm run verify:payments` | Is the Paymob callback signed, idempotent, amount-checked, and identical to a manual settle? | no (db only; no network, no real keys) |
| `npm run verify:auth` | Do both sign-in rails and the role matrix work? | no (db only) |
| `npm run verify:arabic` | Does any English leak into any route? | **yes** |
| `npm run verify:hero` | Does the landing film scrub, bounded, without strays? | **yes** |
| `npm run verify:journeys` | Can a buyer/creator/admin complete their whole job? | **yes** |
| `npm run verify:flows` | Do dashboard controls actually mutate? | **yes** |
| `npm run audit` | Any script errors, a11y or RTL defects on any route? | **yes** |

`npm run test` runs unit first (fastest feedback), then the database gates, then
the browser gates.

## Why the browser gates exist

**HTTP 200 proves nothing.** Both dashboards once rendered an error boundary on
every single route while returning 200, in Arabic, with a green build and a
passing lint. Nothing except opening the page in a browser could see it.

Three classes of bug only a real browser catches, all of which have actually
shipped here:

- A component that throws at render — the route still returns 200 because the
  error boundary renders successfully.
- A control that does nothing — the click handler runs, the request fires, and
  the navigation is silently dropped.
- Text that is correct in the DOM and wrong on screen — bidi reordering turned
  `01/08/2026` into `012026/08/` on every dated surface.

## Interpreting a failure

Every gate prints `PASS` / `FAIL` per check with the specific value that failed:

```
FAIL  a creator is refused /admin — ADMIN CONTENT LEAKED
FAIL  scrolling scrubs the film forward — 9.7 → 9.7
```

The detail after the dash is the actual observed value. Start there, not in the
code.

**If a gate fails, decide first whether the TEST or the APP is wrong.** Several
"failures" during this suite's construction were the test misreading correct
Arabic-RTL behaviour:

- The app **rewrites** rather than redirects on a forbidden route, so the URL
  stays put by design — assert on page content, not the address bar.
- `ar-SA` renders the Arabic percent sign `٪` (U+066A), not ASCII `%`.
- The album buy control is a **link** to `/cart/add`, not a button.
- Sign-in resolves client-side and can leave the address bar on `/sign-in` —
  check `/api/auth/session`, not the URL.

## Adding a route

A new route must be added to two lists or it is untested:

1. `ROUTES` in `scripts/audit-portal.ts` — renders, a11y, RTL, responsive.
2. `ROUTES` in `scripts/verify-arabic.ts` — no English leakage.

If it has controls that mutate, add a case to `scripts/verify-flows.ts`. If it
is part of a user's job end to end, add a step to `scripts/verify-journeys.ts`.

## Known gaps

Honest list — these are **not** covered:

- **Payment gateway dormant until configured.** Paymob (card + Apple Pay) is
  built, but `availableMethods()` offers it only when the `PAYMOB_*` variables
  are set. `verify:payments` drives the callback handler and the intention
  request with a throwaway secret and a stubbed `fetch`; nothing has been
  charged against a real Paymob account, and Paymob's hosted page itself is
  never exercised by a gate.
- **No cloud storage in development.** The S3 driver exists but is off without
  `S3_MASTERS_BUCKET` + `AWS_REGION`; the local driver resolves keys to
  `/media/<key>`, which nothing serves. Download signing and entitlement checks
  are real, the byte source is not. No ZIP builder exists. Public media keys
  without `NEXT_PUBLIC_MEDIA_CDN_URL` resolve to null, so pages show posters.
  `media:upload` is a dry run without AWS env. See `docs/tech/media-aws.md`.
- **No clip upload.** Nothing in the creator portal creates a `Clip`; they
  arrive via seed only. `canSubmit` requires ≥8 clips.
- **Release documents are stubs** — `fileKey` is written as `pending/<id>`.
- `/cart/add` and `/boards/[token]` are in no gate.
- `verify:flows` covers only studio and admin controls; no public mutation
  (cart tier, remove, place order) is exercised in a browser.

See `specs/` for the per-route detail behind each of these.
