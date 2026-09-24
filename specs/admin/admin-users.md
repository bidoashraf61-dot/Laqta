# Users

**Route** `/admin/users` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Find any account by whatever the customer wrote from — an email, a phone number, or a
name — and open it. The start of every support conversation for an operator who runs
Laqta alone.

## Data in
- `searchParams.q` — `lib/admin-users.ts#userSearchWhere`: case-insensitive `contains`
  over `email`, `name`, `legalName`, `creator.displayNameAr`, `creator.displayNameEn`,
  and `phone`. For the phone, the query is also reduced to digits with a leading `00` or
  national `0` dropped (at least 4 digits), so `0555…` finds `+966555…`.
- `searchParams.role` — accepted if in `buyer | creator | admin`; otherwise ignored.
- The house account (`creator.isHouse`, licensor of the free sample) is always excluded.
- `User.findMany` — `orderBy createdAt desc`, `take: 100`, selecting id, email, phone,
  name, role, status, createdAt, `creator.displayNameAr`, `_count.orders`.
- `User.groupBy({ by: ['role'] })` over the same search (without the role filter) — chip
  counts.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` («بريد أو اسم أو رقم جوال») | GET form / `?q=` | re-queries the table |
| `FilterChips` (`param="role"`: الكل / مشترٍ / صانع محتوى / مدير, with counts) | plain `<a>` to `?role=` | re-queries the table |
| Name in the first column | plain `<a>` (`data-user-row`) | → `/admin/users/{id}`. A plain anchor on purpose — see CLAUDE.md, "Client-router navigations that never commit" |

Columns: المستخدم (creator display name, else name, else email, else phone; with
email · phone beneath in `.ltr-island`), الدور, الحالة (`StatusBadge domain="user"`:
نشط neutral / موقوف destructive / بانتظار التحقق warning), الطلبات, انضم في.

## States
- **Empty result** — `EmptyState` «لا حساب يطابق البحث» with the page hint.
- **Truncation** — hard `take: 100`, newest first, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Read-only. Nothing on this page mutates.
- Every account is listed, including admins — an admin row opens to a page with no
  suspend and no view-as control.

## Verified by
`verify:flows` (search by email finds the seeded buyer, the row opens the detail page).
Not yet in `verify:arabic` / `audit` route lists.
