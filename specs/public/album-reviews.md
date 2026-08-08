# Album reviews

**Surface** the review section on `/albums/[creator]/[slug]` · **Access** read public, write owners only

## Purpose
Let a buyer say whether the album did the job, under the album it is about.

## Data in
- `getAlbumReviews(albumId)` — `status='published'`, newest first, take 20.
- `getOwnReview(userId, albumId)` — the viewer's own review, so the form opens on what they actually gave.
- `ownsAlbum(userId, albumId)` — presence of an `Entitlement`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Star radios (1–5) | `reviewAlbum` server action | Upserts on `[albumId, userId]`, then recomputes `Album.ratingAvg` / `ratingCount` |
| Body textarea | same | Optional; a star with no words is still a signal |

## States
- **Anonymous** — no form, and a line saying to sign in. A missing control with no explanation reads as a broken page.
- **Signed in, does not own** — no form, and a line saying reviews are for buyers.
- **Owner, no review yet** — form defaults to 5.
- **Owner, already reviewed** — form opens on their rating with their text prefilled.
- **No reviews** — `review.none`.

## Invariants
- **Ownership is enforced server-side**, not just hidden in the UI. Without an `Entitlement` the action returns `review.mustOwn`, which puts review-bombing a purchase away rather than a signup away.
- **One verdict per buyer per album**, backed by `@@unique([albumId, userId])`. Upsert, not create — a buyer who changes their mind should be able to, and stacking ten reviews from one account should be impossible.
- **Every rating prints its number beside its stars.** A row of glyphs is unreadable to a screen reader and ambiguous at a glance.
- **The count always travels with the average.** An average without its sample size is not a rating, it is a rumour — 5.0 from one buyer must not outrank 4.6 from ninety.
- `ratingAvg` / `ratingCount` are **written back**, not aggregated per read: the album page is the most-visited route in the catalogue and this figure changes a few times a month.
- **`AggregateRating` is emitted only when `ratingCount > 0`.** A rating block with zero reviews is a structured-data violation Google penalises, not a harmless empty field.
- Moderation **hides, never deletes** (`status='hidden'`). A deleted review is an argument with a customer you cannot reconstruct.
- The author label falls back to «مشترٍ موثّق», never an email — a reviewer's address is not ours to publish because they left a star.

## Verified by
- Manual, in a browser: anonymous sees the sign-in line; the owner submits 4★ with a body; after reload the section reads «4.0 من ٥ · 1 تقييم» with the review shown; the form reopens on 4 with the text prefilled; `aggregateRating` appears in JSON-LD with `ratingValue: "4.0", reviewCount: 1`.
- `npm run audit` — route clean at desktop and phone.
