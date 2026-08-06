# Creators

**Route** `/admin/creators` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
The creator roster with the per-creator levers: approve an application, suspend or
reinstate, and set tier / commission override.

## Data in
- `searchParams.q` — case-insensitive `contains` over `displayNameAr`, `displayNameEn`,
  `handle`.
- `searchParams.status` — accepted only if it is one of `statusValues('creator')`
  (`pending, approved, suspended, rejected`); otherwise ignored.
- `Creator.findMany` — `orderBy [status asc, lifetimeGmv desc]`, `take: 100`, includes
  `user.email` and `_count.albums`.
- `Creator.groupBy({ by: ['status'] })` — chip counts.
- `lib/commission.TIER_RATES` — used in the page to derive the displayed rate:
  `commissionRateOverride ?? (TIER_RATES[tier] − (isExclusive ? 0.05 : 0))`, then shown
  as the **creator's** share (`1 − platformRate`).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` | GET form / debounced `router.replace` to `?q=` | re-queries the roster |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the roster |
| Creator name | link | → `/creators/{handle}` (public profile) |
| «اعتماد» (shown when `status === 'pending'`) | `approveCreator(creatorId)` | `Creator.status='approved'`, `approvedAt=now`; `User.role='creator'`. Audits `creator.approve` |
| «إيقاف» (shown when `status === 'approved'`) | `setCreatorStatus(id,'suspended')`, native confirm | `Creator.status='suspended'`, `suspendedAt=now`, **and every `live` album of theirs → `paused`**. Audits `creator.suspended` |
| «إعادة تفعيل» (shown when suspended / rejected) | `setCreatorStatus(id,'approved')` | status back to `approved`, `suspendedAt=null`, `approvedAt=now`. Albums are **not** un-paused automatically |
| «تعديل العمولة» disclosure | local state | opens the commission form |
| Commission form (tier select + override % input) | `setCreatorCommission` (`SettingsForm` / `useActionState`) | writes `Creator.tier` and `Creator.commissionRateOverride`. Audits `creator.commission.update` |

## States
- **Empty result** — `EmptyState` with `dash.noCreators`.
- **Role-conditional buttons** — the status verbs shown depend entirely on
  `creator.status`; a `pending` creator gets only approve, a `rejected` one only
  reinstate.
- **Override validation failures** (rendered inline above the form by `SettingsForm`):
  tier not in `standard|silver|gold` → `state.error`; override not finite, `< 0` or
  `> 50` → `dash.commissionOverrideHint`. An empty override field stores `null`
  ("derive from tier").
- **Pending** — `ActionButton` shows a spinner and disables; `SubmitButton` reads
  `useFormStatus`.
- **Success** — `ActionButton` toasts and `router.refresh()`; the form renders a success
  `Alert` with `dash.saved`.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- **Commission is frozen at purchase.** Changing tier or override here affects future
  sales only. Existing `OrderItem` rows carry their own `commissionRate` /
  `commissionAmount` and nothing on this route recomputes them (`lib/commission.ts`,
  "THE RULE").
- The override is typed as a percentage and stored as a fraction (`value / 100`), clamped
  by the form to 0–50; `resolveCommission` additionally clamps to `[0, 0.5]`.
- Suspension **pauses** the creator's live albums rather than delisting them, so
  reinstating is one click and no buyer entitlement is affected — entitlements are served
  from `OrderItem.clipManifestSnapshot`, not from album state.
- Every mutation writes an `AuditLog` row.

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/creators`).
The frozen-commission rule itself is covered by `verify:money`.
