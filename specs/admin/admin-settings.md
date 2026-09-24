# Platform settings

**Route** `/admin/settings` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
Show the platform's operating constants — commission tiers, SLA, hold period, minimum
payout, VAT, current licence version, storage status — so an operator can answer "what
rate does a Silver creator get" without reading TypeScript.

## Data in
- `LicenceVersion.findFirst({ orderBy: { createdAt: 'desc' } })` — version string and
  creation date.
- `AuditLog.findMany` — `orderBy createdAt desc`, `take: 15`, includes
  `actor` (name, email).
- Constants, not database rows:
  - `lib/commission.TIER_RATES`, `TIER_THRESHOLDS_SAR`, `EXCLUSIVE_BONUS_POINTS`
  - `lib/studio.MIN_PAYOUT_SAR` (`500`)
  - `lib/storage.storageConfigured` — `true` when the `s3` driver is active, i.e.
    `S3_MASTERS_BUCKET` and `AWS_REGION` are both set (credentials come from the AWS SDK
    default chain, so their presence is not part of the test)
  - `lib/mail.mailConfigured` — `Boolean(MAIL_PROVIDER && MAIL_API_KEY && MAIL_FROM)`,
    read at module load; the Mail panel beside storage shows it with pending / sent /
    failed `MailOutbox` counts. See `specs/mail.md`.
  - `process.env.VAT_RATE` (default `0.15`)
  - Review SLA `"3"` and payout hold `"30"` are **hard-coded strings in the JSX**, not
    read from the constants or env that actually drive those behaviours.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «المزيد» on the audit panel | link | → `/admin/reports` |

**Everything else on this page is read-only and says so.** An info `Alert` renders
`dash.settingsReadOnly`: "هذه القيم مثبّتة في الكود حالياً وتظهر هنا للمراجعة." There is
no settings table and no editor anywhere in the admin area for these values.

## States
- **No licence version on file** — the licence panel renders `state.empty`.
- **No audit rows** — the audit panel renders `state.empty` text.
- **Storage badge** — success when masters are on S3 (`S3_MASTERS_BUCKET` + `AWS_REGION`),
  warning otherwise. It reflects only whether env vars are set; nothing here uploads,
  probes the bucket, or verifies the credentials. It says nothing about the public media
  CDN (`NEXT_PUBLIC_MEDIA_CDN_URL`) — see `docs/media-aws.md`. Local development runs on the honest
  local storage driver, so this badge is normally a warning. The line beside it
  (`studio.uploadHint`) reads «بدون التخزين السحابي تبقى ملفات المبدعين ومستنداتهم على
  هذا الخادم وحده، ولا تصلح للنشر.» — creator uploads and release scans work on the local
  driver, but only on this machine.
- **Audit entry with no actor** — em dash.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- The two frozen invariants are deliberately **not configurable**: entitlement is served
  from `OrderItem.clipManifestSnapshot`, and commission is frozen on the `OrderItem` at
  purchase. Neither has a control anywhere in the admin area, by design
  (`lib/orders.ts`, `lib/commission.ts`).
- The tier table displays the **creator's** share (`1 − TIER_RATES[tier]`), matching the
  figure shown on `/admin/creators`.
- `TIER_THRESHOLDS_SAR` are SAR figures rendered through `formatMoney`, which formats in
  the portal's USD default — the numbers are correct, the currency symbol beside them is
  not the currency they are denominated in.
- Read-only: nothing on this route mutates anything.

## Verified by
`verify:arabic`, `audit`. Not covered by `verify:flows`. The constants it displays are
exercised by `verify:money`.
