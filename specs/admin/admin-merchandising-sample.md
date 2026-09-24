# Free sample curation

**Route** `/admin/merchandising/sample` · **Access** admin only · **Rendering** server, dynamic (`requireAdmin()`, `?album=` search param)

## Purpose
Choose which clips go into the free sample album, set its title and description, and publish or unpublish it. The owner decides the contents later, so an empty, unpublished sample is the normal starting state.

## Data in
- `getSampleForAdmin()` (`lib/sample.ts`) — the sample, its house album's title/description/cover, and every chosen clip with its source album (including clips whose album is no longer live, flagged).
- `Album.findMany({ status: 'live' })` — the album picker.
- With `?album=<id>`: that album's clips in `orderIndex` order.
- `Entitlement.count({ albumId: sample album })` — how many accounts have claimed it.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «انشر العيّنة» / «أوقف النشر» | `setSamplePublished(bool)` | Publishing is refused with «أضف لقطة واحدة على الأقل من ألبوم منشور قبل النشر.» when no chosen clip sits in a live album |
| Details form (title AR/EN, description AR/EN) | `saveSampleDetails` | Arabic title required («العنوان العربي مطلوب.»); an empty English title falls back to the Arabic |
| Album chips | plain `<a>` → `?album=<id>` | Lists that album's clips (plain anchor: load-bearing same-pathname navigation, per CLAUDE.md) |
| «أضف» per clip | `addSampleClip(clipId)` | Refused for a clip whose album is not live; an added clip shows «مضافة» |
| «أعلى» / «أسفل» | `moveSampleClip(clipId, dir)` | Reorders |
| «اجعلها الغلاف» | `setSampleCover(clipId)` | Sets the house album's cover clip |
| «احذف» | `removeSampleClip(clipId)` | Removes from the sample |
| «افتح الصفحة العامة» | plain `<a>` → `/sample` | Shown once a clip is offered; an admin sees an unpublished sample there with a notice |

Reached from a panel at the top of `/admin/merchandising` («العيّنة المجانية»). Every action re-checks the admin, writes one `AuditLog` row (`sample.*`), and revalidates this page, `/sample` and `/albums`. The first write creates the house user, creator, album and sample row (`ensureSample`, idempotent); a page render never writes.

## States
- **No sample row / no clips** → «ما اخترت لقطات بعد. اختر ألبوماً من الأسفل وأضف منه.»; status badge «غير منشورة».
- **A chosen clip whose album stopped being live** → struck through with «ألبومها غير منشور، فلا تُعطى»; it is not offered to claimants.
- **No album picked** → «اختر ألبوماً منشوراً لعرض لقطاته.»

## Invariants
- Curation changes only what the **next** claimant gets; existing claims keep their frozen manifest.
- The house album never goes `live`; publication is `SampleAlbum.isPublished` only.

## Verified by
`verify:flows` (the page renders with no console errors; the album picker lists clips to add). The actions' effect on claims is covered by `verify:sample`.
