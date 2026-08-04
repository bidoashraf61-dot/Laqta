# Laqta — Design Language

Extracted from **Al Diaar Real Estate** (Bareq Studio, Jeddah — art direction Ahmad Ghanem,
brand applications Youssaf Mohammad, motion Ahmed Shoukry) and adapted for Laqta.

Source: https://www.behance.net/gallery/249380817/Al-Diaar-Real-Estate-Branding-Project

---

## ⚠️ Read this before applying any of it

Al Diaar is a **real-estate asset manager**. Laqta is a **cinematic footage marketplace**.
Their brief was permanence, stewardship and institutional calm. Yours is motion, light and
craft. The two want opposite things from a page, and the palette below is the clearest
example: Al Diaar is light-first and deliberately undramatic, while Laqta's whole product is
a dark cinematic scroll built from your own film.

So this document separates two things, and they are not the same:

| | |
|---|---|
| **Adopt** — the method | Restraint, ratio-based colour, Arabic-first typographic discipline, one geometric motif carried everywhere, generous air, photography as the loudest element |
| **Do not copy** — the artefact | Their exact palette as a set, the pointed-arch image mask as a signature device, the palm mark, the lockup construction |

The second column is a specific company's trade dress, made for a client in your own market.
Reproducing it as a system creates real legal exposure and, more practically, would make
Laqta look like an Al Diaar sub-brand. **Take the discipline; keep your own voice.**

---

## 1. What Al Diaar actually does (the extraction)

### 1.1 Strategy is stated as a position, not adjectives

The identity opens with a **brand attribute scale** — seven axes with a marked position on each:

```
Short-term Deal  ──●─────────  Legacy
Superficiality   ───●────────  Authenticity
Speculation      ───●────────  Preservation
Casual           ──────●─────  Formal
Fragility        ───────●────  Strength
Ambiguity        ─────────●──  Transparency
Complexity       ───────●────  Investment Ease
```

Two things matter here. The dots are **not all at the extremes** — the brand commits to being
only moderately "Legacy" but strongly "Transparent". And every later decision is traceable to
one of these axes. That is why the work reads as coherent rather than merely tasteful.

### 1.2 Colour is a ratio system, not a palette

Every colour carries a **percentage of total surface**. This is the single most transferable
idea in the whole project.

| Role | Name | Hex | RGB | Share |
|---|---|---|---|---|
| Main | Dark Olive Green | `#5F5F4C` | 95, 95, 76 | **30%** |
| Main | Gold | `#E4B363` | 228, 179, 99 | **20%** |
| Secondary | Off White | `#EFEBE0` | 239, 235, 224 | **20%** |
| Secondary | Dusty Olive | `#B7B698` | 183, 182, 152 | **15%** |
| Secondary | Black | `#1A1A1A` | 26, 26, 26 | **15%** |

Each colour also ships a **four-step tint ramp** toward white, used for surfaces and states —
never a second hue.

Note what is absent: no blue, no red, no "accent" colour, no gradient. Five values, fixed
proportions, total 100%. The restraint is the identity.

### 1.3 One geometric motif, carried everywhere

The **pointed arch** (the mihrab/window silhouette from Najdi and Hejazi architecture) appears
as: the monolith form in the hero renders, the recessed niches in the photography, the icon
system, and — critically — as an **image mask**. Photographs are cropped *into* the arch rather
than placed in rectangles.

Icons are built on a visible **modular grid** with the arch as the constructing shape, so the
mark, the icons and the image crops are provably the same geometry.

### 1.4 Typography

Bilingual lockup, Arabic **above or leading** the Latin, never subordinate. Observed rules:

- **Two-weight headlines.** Line one light, line two bold, same size:
  `PARTIAL OWNERSHIP OF` / **`REAL ESTATE ASSETS`**
- **Body copy is deliberately small** with wide tracking — it is texture, not reading matter.
  The photograph does the talking.
- Latin display set in **uppercase with open letter-spacing**; Arabic set at its natural case
  with generous line-height.
- A **pill-shaped chip** carries the URL at the foot of every poster — the only rounded shape
  in an otherwise sharp system.

### 1.5 Photography

Warm, sun-bleached, single-source daylight with **long hard shadows**. Sand, plaster, palm.
Almost no people. Low saturation, high luminance. The architecture is shot flat-on and
symmetrical — never a dutch angle, never a wide-angle flourish.

### 1.6 Layout

Alternating full-bleed panels — off-white, then olive, then image — so a scroll reads as a
sequence of held frames rather than a continuous page. Enormous margins. Content occupies
roughly the middle half of the canvas.

---

## 2. What Laqta adopts

### 2.1 Position (fill this in — it is currently missing)

Laqta has no attribute scale. It should. Proposed, to be argued with:

```
Stock library    ─────────●──  Curated catalogue
Global           ────────●───  Saudi-specific
Subscription     ──────────●─  Owned outright
Cheap            ───────●────  Considered
Cold utility     ──────●─────  Cinematic
Anonymous        ─────●──────  Creator-credited
```

The rightmost positions are already true of the product — album-only, cleared-for-commercial,
buy-once. The design should stop under-selling them.

### 2.2 Colour — keep Laqta's palette, adopt Al Diaar's ratio discipline

Laqta's existing tokens came from the hero film and should **stay**. What changes is that they
now carry proportions, which they currently do not:

| Role | Token | Hex | Share | Use |
|---|---|---|---|---|
| Base | `--ink` | `#14141A` | **55%** | Page ground. The catalogue lives inside the film. |
| Surface | `--card` / raised | — | **20%** | Cards, rails, sheets |
| Accent | `--gold` | `#C8A24A` | **12%** | Price, primary action, active state. **Nothing else.** |
| Warm neutral | `--sand` | `#E9DCC3` | **8%** | Body copy on dark, quiet chrome |
| Signal | `--oasis` / `--clay` | `#2F8F5B` / `#C06A3E` | **5%** | Cleared badge, warnings — status only |

**The rule that matters:** gold is 12%, not "wherever a highlight would look nice". Today it is
on the logo, the nav hover, every heading hover, the price, the CTA, the badge and the focus
ring. That is closer to 30% and it is why nothing feels expensive. Gold should mean *money or
action* and nothing else.

Adopt the **four-step tint ramp** convention for each token rather than ad-hoc `/10 /15 /20`
opacity values scattered through the components.

### 2.3 Motif — the frame, not the arch

Do not use the pointed arch; it is Al Diaar's and it reads as heritage real estate.

Laqta's equivalent geometry is already sitting in the product and is unused: **the aspect-ratio
frame**. 16:9, 2.39:1, 9:16, 1:1 are the literal shapes of the thing being sold. Use the
letterbox — a 2.39:1 crop with the ink bars kept — as the recurring device: hero, album covers,
empty states, the 404, the loading skeleton. It is cinematic, it is ours, and it is honest
about the product.

Corollary: **stop cropping everything to 16:9 by default.** A 9:16 clip shown in a 16:9 card is
a lie about what the buyer is getting.

### 2.4 Typography — adopt wholesale

This is where Al Diaar is strongest and Laqta is weakest.

- **Two-weight headline.** Currently every heading is one weight at one size. Adopt the
  light-over-bold pair for section heads: `لقطات سعودية،` light / **`بجودة سينمائية.`** bold.
- **Shrink body copy and open the tracking.** Body is currently competing with headlines.
- **Arabic leads.** Already true. Keep it — and where a Latin technical term appears, it stays
  isolated (`.ltr-island`), which the codebase already enforces.
- **One rounded shape only.** Al Diaar allows itself the URL pill. Laqta's equivalent is the
  **price chip** — make it the only fully-rounded element on a card and it becomes the thing
  the eye lands on. Everything else takes `--radius`.

### 2.5 Photography and stills

Al Diaar's treatment is warm, flat-on, hard-shadowed, few people. Your hero stills already are
this. The gap is the **catalogue**, where thumbnails are arbitrary frames.

- Album covers should be **graded consistently** within an album — the PDP already warns
  creators about mixed specs; extend that thinking to the cover.
- Prefer **one hero still per album** over a collage.
- Keep people rare in chrome imagery; they belong in the footage, not the furniture.

### 2.6 Layout — alternating held frames

Currently every landing section is `container py-14` on the same ground, so the page reads as
one long column. Adopt Al Diaar's alternation:

```
hero (full-bleed film)
trust strip        ink, edge-to-edge
featured albums    raised surface
locations          full-bleed image band
categories         ink
how it works       raised surface
creator CTA        gold-tinted panel
```

Widen the margins. Content should occupy roughly the middle 60–70% at desktop, not 90%.

---

## 3. Concretely, what to change first

Ranked by visible effect per hour:

1. **Ration the gold.** Remove it from nav hover, heading hover and non-price text. Price,
   primary CTA and active state only.
2. **Two-weight headlines** on the landing sections and the album PDP title.
3. **Alternate section grounds** on the landing page.
4. **Letterbox device** on album covers and empty states; stop forcing 16:9.
5. **Price chip** as the only pill; everything else `--radius`.
6. **Widen margins**, shrink body copy, open tracking.

Items 1–3 are roughly an hour and change the feel more than the rest combined.

---

## 4. Credit

The strategic method (attribute scale, colour ratios, single-motif construction) is Bareq
Studio's on the Al Diaar project. It is documented here as a reference standard for Laqta's
own system — not as assets to reuse.
