# Studio settings

**Route** `/studio/settings` · **Access** creator or admin (`requireCreator`; no `creatorId`, or no `Creator` row → `/sell`) · **Rendering** server, dynamic

## Purpose
Edit the public creator profile and the private payout rail, and state the creator's
current revenue share.

## Data in
- `Creator.findUnique` by session `creatorId` — the whole row. Read for: `tier`, `lifetimeGmv`, `commissionRateOverride`, `isExclusive`, `handle`, `displayNameAr/En`, `bioAr/En`, `city`, `country`, `showreelUrl`, `payoutMethod`, `iban`, `bankName`, `beneficiaryName`, `payoneerEmail`, `wiseEmail`, `taxResidency`.
- `TIER_RATES` from `lib/commission.ts` — the displayed share is `1 − platformRate`, where `platformRate` is `commissionRateOverride` if set, else `TIER_RATES[tier] − (isExclusive ? 0.05 : 0)`.

## Controls
| Control | Action | Effect |
|---|---|---|
| Profile form → «حفظ» | `updateProfile` | Updates `handle`, `displayNameAr/En`, `bioAr/En`, `city`, `country` (upper-cased, defaults `SA`), `showreelUrl`; revalidates `/studio/settings` and `/creators/{handle}` |
| `handle` | form field, `pattern="[a-z0-9][a-z0-9\-]{1,38}"` | Lower-cased and re-validated server-side against `HANDLE_PATTERN`; uniqueness checked against other creators |
| Payout form → «حفظ» | `updatePayoutDetails` | Updates `payoutMethod`, `iban` (whitespace stripped, upper-cased), `bankName`, `beneficiaryName`, `payoneerEmail`, `wiseEmail`, `taxResidency` (upper-cased); writes `AuditLog` `creator.payout_details.update`; revalidates `/studio/settings` |
| «الأمان» button | Link → `/account/security` | Navigation only — 2FA lives outside the studio |

The commission panel is display-only: neither tier nor override is editable here.

## States
- **Two independent forms** — a validation failure in the profile cannot block saving a corrected IBAN, and vice versa.
- **Profile errors** — missing `displayNameAr`/`displayNameEn` → `dash.displayNameAr`; handle failing the pattern **or already taken** → `dash.handleHint` (the same message for both, so a taken handle reads as a format error).
- **Payout errors** — method outside `iban|payoneer|wise` → `state.error`; the field matching the chosen rail empty → `dash.iban` / `dash.payoneerEmail` / `dash.wiseEmail`.
- **Success** — a green alert (`dash.saved`) above the fields; the form does not redirect.
- **Pending** — submit button disabled with a spinner.
- **No creator profile, or the `Creator` row cannot be loaded** → `redirect('/sell')`.
- **Withholding rate and tax form** (`withholdingRate`, `taxFormOnFile`) are on the model and used by `requestPayout`, but are **not editable or shown** on this page.

## Invariants
- The commission figure is informational. Rates are resolved once at purchase (`resolveCommission`) and frozen on `OrderItem`; changing nothing here can change a past order, and a tier promotion never backdates.
- The payout rail is editable at any time — including while a payout is queued. What protects an in-flight transfer is that admin approval freezes `Payout.destinationSnapshot`, not a lock on this form.
- `creatorId` always comes from the session; the forms never carry an identity field.
- Editing the handle revalidates the old path's cache entry for the new handle only (`/creators/{handle}`); the previous public URL is not redirected.

## Verified by
`verify:flows` (fills `#city`, submits, reloads and asserts the value persisted, then restores it; asserts no console errors), `verify:arabic`, `audit`.
