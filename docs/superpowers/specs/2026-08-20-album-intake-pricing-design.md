# Spec B — Album intake and pricing

**Status** approved 2026-08-20, not built · **Order** third of three (A → C → B)

## Purpose

The album submission form asks for five things: two titles, two descriptions,
and a tier. None of them help a buyer find the album, none of them protect the
platform legally, and the price is derived automatically with no operator
judgement in it.

This spec makes submission complete, gives the operator the final say on price,
and gives the creator a say before their work is sold at it.

## Why last

It is the largest of the three and the least urgent. A launch catalogue of four
or five albums is curated by hand; an intake pipeline serves a scale that does
not exist yet. It also needs Spec A, because "your album is priced, please
accept" is a message — without it the album sits in limbo.

## The deal changes, and the page must say so

`/sell` currently promises creators:

> «السعر يُشتق من عدد اللقطات — لا تفاوض على السعر ولا مزايدة»
> «الشريحة تحدّده حسب عدد اللقطات، حتى يبقى للكتالوج سعر واحد لكل حجم ألبوم»

After this spec that is untrue. The band becomes a **guide**, the operator sets
the final price, and a creator who disagrees can negotiate. That is a real
change to the creator's deal and the page rewrites to describe it honestly —
not softened, not left stale. A creator who reads the old promise and meets the
new behaviour has been misled, and `/sell` is the one page they read before
committing their archive.

## What the creator supplies

The form grows from five fields to a complete submission.

| Field | Why it is required |
|---|---|
| Titles, descriptions (ar/en) | Already collected |
| **Category** | A filter buyers actually use |
| **Location** | The product's whole premise is Saudi places |
| **Time of day** | Already a filter on `/footage`, currently unpopulated at source |
| **Orientation** | Shown on every album card |
| **Origin — real shooting or AI** | Already a badge on every card, and buyers must declare synthetic media in campaigns. Nothing currently asks the creator to state it. |
| **Tags** | Discovery and search. See below. |
| **Permits and releases declaration** | An explicit statement that identifiable faces have releases and the location permitted filming. This protects the platform, not the creator. |
| **Suggested price + one line of reasoning** | So the operator decides with context rather than guessing |

Without category, location and time of day an album is invisible to every
filter on `/footage` — which is the current state of the intake path.

### Tags

Creators **pick from a fixed list**, and may **propose a new tag** when the one
they need is missing. A proposal arrives with the album in the review queue,
where the operator approves it, edits the wording, or rejects it.

The starting list is drafted from the existing `Taxonomy` rows, the categories
and locations already in use, and the plausible search vocabulary of a Saudi
buyer — then cut and corrected by the operator before it ships.

Free-text tagging is what produces «العلا», «العُلا» and «AlUla» as three
separate tags within a year. A fixed list with a proposal route keeps the
vocabulary clean while still growing from real demand.

Tags also become **clickable** on the clip and album pages, routing into
filtered browse. Two reasons: a buyer who liked one shot finds more, and each
tag becomes a page that can rank for a real Arabic search phrase — the cheapest
search traffic available to a catalogue this size.

### Guidance, four ways

1. **A checklist before starting** — everything needed, gathered once, so
   nobody abandons halfway through discovering they lack a release form.
2. **Hints inside the form** — nobody reads documentation; everybody reads the
   label they are typing under.
3. **One worked example album** — filled in correctly, as the standard to copy.
4. **Rejection feedback** — `changes_requested` already exists; it gains the
   specific failed checks rather than a general note.

## Pricing and consent

### The flow

```
creator submits (with suggested price)
        │
        ▼
  in_review ── operator sees: band guide · creator's suggestion · reasoning
        │
        ├─ changes requested ──→ changes_requested (existing)
        │
        └─ approved + price set
                 │
                 ▼
        priced ── awaiting creator acceptance     ← NEW STATE
                 │
                 ├─ creator accepts ──────────────→ live
                 │
                 └─ creator counters (with reason)
                          │
                          ▼
                    negotiation thread
                          │
                          ├─ agreed ─→ priced → accepted → live
                          └─ withdrawn ─→ draft
```

### The new state

`AlbumStatus` gains **`priced`**: reviewed, approved, priced, and waiting on the
creator. Approval no longer publishes directly — `decideReview` sets the price
and moves the album to `priced`, and acceptance is what sets `live` and
`publishedAt`.

This is the one structural change in the spec. Everything that currently reads
`status='live'` continues to work unchanged; `priced` is simply not live yet.

### Negotiation

A short thread on the album: the creator counters with a price and a reason,
the operator replies, either side settles. Bounded by nothing except agreement
— the operator chose open negotiation over a single counter.

Every message is a message on the Spec A rail, so neither side has to sit
watching a dashboard.

### Repricing later

The price band editor (Spec C) can reprice live albums and notifies creators.
That path does **not** re-open acceptance: acceptance is consent to publish at
a price, not a permanent veto over the catalogue's pricing. The notification is
what keeps it honest, and a creator who objects can pause or withdraw the album
through the studio as they already can.

## Data model

```
AlbumStatus                += priced

Album                      += originDeclared      AlbumOrigin
                           += timeOfDay           String?
                           += suggestedPrice      Decimal?
                           += suggestedPriceNote  String?
                           += releasesDeclaredAt  DateTime?
                           += priceAcceptedAt     DateTime?

AlbumTagProposal           (new) albumId, labelAr, labelEn, status, decidedBy
AlbumPriceMessage          (new) albumId, authorId, price?, body, createdAt
```

`Album.origin` and `Album.orientation` already exist; `originDeclared` records
that the *creator* stated it rather than an operator inferring it, which is the
point of a declaration.

## States

- **Creator never answers a price** — the album stays `priced`. It appears in an
  operator list of stalled albums. No automatic withdrawal: silence is not
  consent, and a quietly-withdrawn album is worse than a visible stuck one.
- **Creator withdraws** — back to `draft`, editable, resubmittable.
- **Tag proposal rejected** — the album still publishes; the proposed tag simply
  does not exist, and the creator is told which approved tag to use instead.
- **Permits not declared** — submission is refused. This is a blocking field,
  matching the existing blocking `releases` check in the review checklist.
- **Suggested price absent** — allowed. It is context, not a requirement.

## Invariants

1. **An album is never live at a price its creator has not accepted.**
2. **The permits declaration is blocking**, consistent with `canApprove` in
   `lib/review-checklist.ts`, which already refuses approval while `releases`
   fails.
3. **Origin is always declared, never inferred.** No heuristic guesses whether
   footage is synthetic.
4. **Tags come from the approved list.** A proposal is not a tag until approved.
5. **`/sell` describes the deal that exists.** If the pricing rule changes
   again, that page changes in the same commit.
6. **Frozen invariants untouched.** Nothing here alters entitlement snapshots or
   commission rates.

## Verified by

- `verify:flows` extended: a complete submission reaches `in_review`; an
  incomplete one is refused; approval lands in `priced` and not `live`;
  acceptance publishes.
- A new `verify:pricing` — asserts no album reaches `live` without
  `priceAcceptedAt`, and that a rejected tag proposal never becomes a tag.
- `verify:arabic` covers the new form copy, the checklist page and the emails.
- `audit` covers the new studio routes at both widths.
- Specs updated in the same change: `specs/studio/studio-albums-new.md`,
  `specs/studio/studio-albums-id.md`, `specs/admin/admin-review-id.md`,
  `specs/public/sell.md`, and both area READMEs.

## Deliberately not in scope

The file upload itself — it needs storage, which arrives with deployment.
Automatic quality or duplicate checks beyond the perceptual-hash report that
`/admin/review/[id]` already produces.

## Open

- **The tag list.** To be drafted and then cut by the operator before build.
