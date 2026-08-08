# Footage requests

**Route** `/admin/requests` · **Access** admin only (`requireAdmin`) · **Rendering** server component, dynamic

## Purpose
The shortest list in the product worth reading daily: buyers naming, in their own words, catalogue that does not exist yet.

## Data in
- `FootageRequest.findMany`, ordered `status asc, createdAt asc`, take 200. Oldest-first within `open`, because a request that has sat a fortnight is the one costing a sale.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| — | — | Read-only by design. Fulfilling a request means shipping an album, which happens in the catalogue; a status control that only changed a label would invite the queue to be marked done without anything being made. |

## States
- **Empty** — `EmptyState` with `request.empty`.

## Invariants
- The buyer's own phrasing (`briefAr`) is never truncated to a taxonomy label. The value of this table is the wording nobody on the team thought of.
- Submission requires **no account**. Most requests come from people who have not signed up; a sign-up wall in front of the request is how you never hear it.
- A storage failure returns `auth.somethingWentWrong`, never a validation message — the visitor must not be told their input was bad when it was not.

## Verified by
- `npm run audit` — route renders clean at desktop and phone.
- Manual: submitted «الطائف في الضباب، لقطات جوية وقت الفجر» from the landing page and confirmed it appears here with email, date and `open` status.
