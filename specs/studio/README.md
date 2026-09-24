# Creator portal (`/studio`)

The creator's side of the platform: publish albums, keep the legal paperwork
straight, and get paid.

Every route sits under the `(studio)` route group. Its layout re-runs the guard
that `middleware.ts` already applied — unauthenticated → `/sign-in?callbackUrl=/studio`,
role other than `creator`/`admin` → `/forbidden` — and wraps the page in
`DashboardShell` with the `STUDIO_NAV` sidebar. Every page then calls
`requireCreator()` again inside itself; all but `/studio/albums/[id]` additionally
redirect a user with no `Creator` row (typically an admin) to `/sell`.

All surfaces are server-rendered and dynamic. Nothing in the studio writes money
or entitlement directly: it requests, and an admin settles.

| Route | Purpose | Spec |
|---|---|---|
| `/studio` | Attention items first, then earnings, traffic and demand signals | [studio.md](./studio.md) |
| `/studio/analytics` | 7/30/90-day performance of the creator's catalogue, with a views → cart → purchase funnel | [studio-analytics.md](./studio-analytics.md) |
| `/studio/albums` | The album working list, with search, status filters and pause/resume | [studio-albums.md](./studio-albums.md) |
| `/studio/albums/new` | Create a draft album from a title and a price band | [studio-albums-new.md](./studio-albums-new.md) |
| `/studio/albums/[id]` | Upload, name, order and delete an album's clips, pick the cover, see per-clip processing state and spec consistency, and submit for review | [studio-albums-id.md](./studio-albums-id.md) |
| `/studio/releases` | Declare model/property/permit releases, attach the scanned document, and link them to the clips they cover | [studio-releases.md](./studio-releases.md) |
| `/studio/earnings` | The creator ledger: available, held with its release date, lifetime | [studio-earnings.md](./studio-earnings.md) |
| `/studio/payouts` | Request a transfer of the available balance; past requests | [studio-payouts.md](./studio-payouts.md) |
| `/studio/settings` | Public profile, payout rail, and the current revenue share | [studio-settings.md](./studio-settings.md) |

## Area-wide rules

- **Every server action re-resolves the creator from the session** and scopes its
  query by `creatorId`. Rendering a page is never the authorisation boundary — a
  server action is reachable by anyone who can guess its id.
- **Money is derived, not stored.** `available` / `held` / `lifetime` come from
  `CreatorLedger.availableAt` (a 30-day hold per sale) minus payouts already
  `approved|processing|paid`.
- **Commission is frozen at purchase** on `OrderItem`; nothing in the studio
  recomputes it, and the settings page's share figure is informational only.
- **Entitlement is frozen at purchase** in `OrderItem.clipManifestSnapshot`;
  pausing, editing or resubmitting an album never changes what a buyer owns.
- **Clip specs come from the file, never the browser.** Uploads go straight to
  private storage ([`/api/studio/uploads`](../api/studio-uploads.md)); ffprobe fills
  the technical columns and the ingest job (`lib/ingest.ts`) makes the watermarked
  preview and poster. Clips are only editable while the album is `draft` or
  `changes_requested`.
- **Nothing here self-approves.** Album publication needs the review queue,
  release verification needs a reviewer, and a payout needs admin approval.

## Not wired

- No clip metadata beyond the two titles is editable in the studio: camera,
  lens, movement, shot size, location, people/faces flags and taxonomy still
  arrive from the seed or an operator. `identifiableFaces` therefore stays
  `false` on uploaded clips unless an admin sets it.
- A release itself cannot be edited or deleted — only its scan.
- The S3 upload path (presigned multipart PUTs) is built and documented but not
  exercised by a gate; `verify:uploads` runs on the local driver.
