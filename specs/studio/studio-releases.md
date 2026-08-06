# Releases and permits

**Route** `/studio/releases` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic

## Purpose
Declare model releases, property releases and shooting permits, and attach each one
to the clips it covers — the data the album submission gate reads.

## Data in
- `Release.findMany` where `creatorId`, `orderBy [{ verification: 'asc' }, { createdAt: 'desc' }]`, including `clipLinks { clipId }`. Renders `subjectName`, `type`, `authority`, `referenceNumber`, `validFrom`/`validTo`, link count, `verification`, `rejectionReason`.
- `Clip.findMany` where `album.creatorId` = this creator AND (`identifiableFaces` OR `hasPeople`), `orderBy createdAt desc`, `take 200`; selects `id, titleAr, identifiableFaces, album.titleAr`. This is the linkable-clip pool for every release on the page.

## Controls
| Control | Action | Effect |
|---|---|---|
| «إضافة مستند» form (`SettingsForm`) | `createRelease` server action | Creates `Release` with `verification: 'pending'` and `fileKey: "pending/{creatorId}"`; writes `AuditLog` `release.create`; revalidates `/studio/releases` |
| `type` select (`model` / `property` / `permit`) | form field | `Release.type`; anything else → `state.error` |
| `subjectName` (required, ≤120) | form field | `Release.subjectName` |
| `authority`, `referenceNumber`, `validFrom`, `validTo`, `notes` | form fields | Stored, `null`/unset when blank |
| «ربط بالمقاطع» disclosure (`ReleaseLinker`) | Toggles an inline checkbox list | No mutation |
| «حفظ الروابط» | `setReleaseClips(releaseId, clipIds)` | Deletes **all** `ReleaseClip` rows for that release and recreates them from the posted selection, in one transaction; `AuditLog` `release.link_clips`; toast + `router.refresh()` |

There is no upload control, no edit and no delete for a release.

## States
- **No releases** — `EmptyState` (`dash.noReleases`); the create panel stays.
- **No linkable clips** — `ReleaseLinker` renders `dash.noLinkableClips` instead of the disclosure.
- **Rejected release** — `rejectionReason` renders in a destructive alert on the card.
- **Verification badge** — `pending` / `verified` / `rejected` via `StatusBadge domain="release"`; only a reviewer can move it, never this page.
- **File not attachable** — a permanent info alert (`dash.releaseFileNote`) states that the scanned document cannot be uploaded yet. **Stubbed**: cloud storage is not wired (`lib/storage.ts` has only a local driver), so `fileKey` is written as the literal prefix `pending/{creatorId}` rather than a real object key.
- **Pending** — form submit disables with a spinner; the linker's save button shows `state.loading`.
- **Errors** — create failures render inline above the form; link failures raise an error toast (`state.notFound` when the release is not owned).
- **No creator profile** → `redirect('/sell')`.

## Invariants
- Both sides of a link are ownership-checked: the release must belong to the session creator, and clip ids are filtered to `album.creatorId = creator` before insert. Ids in the payload are treated as guessable.
- The selection posts whole — unchecking a clip really removes the link, so what the creator sees equals what `canSubmit` reads.
- Verification is never self-served: `createRelease` always writes `pending`, and the album gate only accepts a `model` release whose verification is not `rejected`.

## Verified by
`verify:arabic`, `audit`. The linker and the create form are not exercised by `verify:flows`.
