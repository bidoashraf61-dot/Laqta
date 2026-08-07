---
name: Laqta
description: The Saudi stock footage library — لقطة
colors:
  gold: "#83682A"
  gold-on-film: "#C8A24A"
  ink: "#14141A"
  sand: "#E9DCC3"
  clay: "#AE6236"
  oasis: "#2F8F5B"
  paper: "#FAF8F3"
  background: "#FAF8F3"
  foreground: "#14141A"
  card: "#FFFFFF"
  muted: "#EFEBE2"
  muted-foreground: "#666370"
  border: "#CFC8BB"
  success: "#2A7E4F"
  warning: "#AB6B04"
  destructive: "#C52020"
typography:
  display:
    fontFamily: "Thmanyah Serif Display, Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Thmanyah Serif Display, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2.125rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline-lead:
    fontFamily: "Thmanyah Serif Display, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2.125rem)"
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  subhead:
    fontFamily: "Thmanyah Serif Text, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.2vw, 1.75rem)"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  prose:
    fontFamily: "Thmanyah Serif Text, Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: "normal"
  prose-lead:
    fontFamily: "Thmanyah Serif Text, Georgia, serif"
    fontSize: "1.35rem"
    fontWeight: 300
    lineHeight: 1.75
    letterSpacing: "normal"
  body:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  eyebrow:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
  button-default:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  price-chip:
    backgroundColor: "rgba(200,162,74,0.12)"
    textColor: "{colors.gold}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
---

# Design System: Laqta

## Overview

**Creative North Star: "The Gallery, Not the Vendor's Table"**

Laqta is the Saudi stock footage library. The page is paper; the film is not.
The whole system is built on that one inversion — an off-white ground, quiet
warm chrome, and dark cinematic frames set into it. A gallery hangs work on a
light wall because the wall is not competing; the same logic applies here.
Every thumbnail, every hero scene, every empty letterbox is a dark frame with
paper around it, and the footage gains contrast that a dark page was taking
away from it.

Dark is therefore not a theme toggle and not a default — it is a property of
the frame. `.dark` is scoped to the hero cinematic, to footage placeholders,
and to overlays that sit on imagery. Nothing else claims it.

The system is deliberately spare. One accent, one type family in three cuts, a
handful of warm neutrals stepping down from paper, and enormous restraint with
colour. Restraint is the identity — the moment three highlights compete,
nothing reads as premium, and premium is the entire pitch against a
subscription library. The visual anti-reference is the generic SaaS admin:
cold greys, a different hue for every status, gradient buttons, decorative
glass. Laqta earns authority by withholding, not by decorating.

Arabic leads everywhere; it is not a translation layer laid over a Latin
design. The page direction is RTL by default and the typeface renders Arabic,
Latin and both numeral sets in one hand.

**Key Characteristics:**
- Paper ground (#FAF8F3) site-wide; the film frames inside it are ink
- One accent (gold), rationed to money / primary action / active state only
- Gold is theme-aware: #83682A on paper, #C8A24A on film — one colour, two grounds
- Thmanyah superfamily: Serif Display large, Serif Text for prose, Sans for UI
- The letterbox (2.39:1) as the recurring geometry — the shape of the product
- Arabic-first, RTL, logical properties only
- Generous margins; content holds the middle two-thirds

## Colors

A warm, low-saturation desert palette — gold and earth on an off-white paper
ground, with the film frames set into it in ink.

### Primary
- **Gold** — **#83682A on paper**, **#C8A24A on film**. The single accent:
  price, the one primary button on a screen, the active nav item, the focus
  ring. It is ONE colour expressed at two lightnesses, because the accent
  carries text and #C8A24A scores 2.20:1 against paper — less than half the
  legibility floor. Same hue, same saturation, so it reads as continuous.
  Never decorative — see the One Voice Rule.
- **Gold Foreground** — paper on the deep gold, ink on the bright one.
  Whatever sits ON a gold fill flips with the fill; hard-coding `text-ink`
  gives you a button that is legible in one world and not the other.

### Neutral
- **Paper** (#FAF8F3): The page ground everywhere. ~60% of any surface.
- **Card** (#FFFFFF): Raised surfaces — cards, panels, the sidebar rail.
- **Muted** (#EFEBE2): Secondary fills, chips, inactive states.
- **Ink** (#14141A): Primary text — and the ground *inside* a film frame.
- **Muted Foreground** (#666370): Secondary text, captions, spec labels.
- **Border** (#CFC8BB): Hairline dividers and card edges.
- **Sand** (#E9DCC3): Warm tint for document surfaces (invoices, certificates)
  and for chrome inside a dark frame. Too pale to carry text on paper.

### Inside a film frame (`.dark`)
Ground #14141A, card #1C1C22, foreground #F5F2EA, border #33333D, gold
#C8A24A. Applied by scoping `.dark` — the hero cinematic, footage
placeholders, badges laid over a thumbnail. Never on `<html>`.

### Status (never expressive — signal only)
- **Oasis / Success** (#2A7E4F on paper, #3AAE6E on film): cleared for
  commercial, paid, live.
- **Clay** (#AE6236) / **Warning** (#AB6B04 on paper, #F0A93A on film): held
  funds, pending, attention.
- **Destructive** (#C52020 on paper, #E36B6B on film): blocking failures,
  reject, overdue SLA.

Every status value is set per ground so it clears 4.5:1 on the card it
actually appears on. The amber that looked right on ink scored 3.33:1 on
white — a warning nobody can read is not a warning.

### Named Rules
**The One Voice Rule.** Gold means money, the primary action, or the active
state — nothing else. Not hover borders, not heading colour, not decorative
fills. On any given screen gold covers well under 15% of surface. Its rarity is
why price and the buy button read as valuable. Audit test: if two gold things
compete for the eye on one screen, one of them is wrong.

**The Dark-Is-A-Frame Rule.** `.dark` describes footage, never chrome. It is
scoped to the cinematic, to cover placeholders, and to overlays sitting on
imagery. The document is paper. A surface that reaches for `.dark` to look
premium has misread the system — on this ground, premium comes from the frames
being the only dark things on screen.

**The Status-Only Colour Rule.** Oasis, clay and destructive appear only as
state — a badge, an alert, a ledger sign. They are never a brand accent and
never decorate a surface.

## Typography

**Display Font:** Thmanyah Serif Display (fallback Georgia, serif)
**Prose Font:** Thmanyah Serif Text (fallback Georgia, serif)
**UI Font:** Thmanyah Sans (fallback system-ui, sans-serif)

**Character:** One Saudi superfamily doing three jobs. Serif Display is high
contrast and tightly fitted — it only works large. Serif Text is drawn to
survive at 16px and carries editorial prose. Sans is the workhorse for every
control. Using one cut in another's role wastes the family; that separation is
the point of licensing a superfamily.

### Hierarchy
- **Display** (700, clamp(2.25rem, 5vw, 4rem), 1.08): Hero and page titles only.
- **Headline** (600–700, clamp(1.5rem, 2.6vw, 2.125rem), 1.2): Section heads,
  album/clip titles.
- **Prose** (400, 1.05rem, 1.9): Album descriptions, creator bios, licence text.
  Serif Text, held to ~65ch.
- **Body** (400, 1rem, 1.75): UI copy, labels, table cells. Sans.
- **Label / Eyebrow** (500, 0.875rem; eyebrow adds 0.14em tracking, gold):
  Overlines above a headline; the one place gold does hierarchy work at a size
  no weight change could.

### Named Rules
**The Two-Weight Headline Rule.** A headline is one size set as two lines — a
Light lead over a Bold statement — giving internal hierarchy with no second
size, colour, or rule. Arabic copy splits on its comma:
`لقطات سعودية،` (light) / **`بجودة سينمائية.`** (bold).

**The Isolated-Latin Rule.** Any Latin run inside Arabic — a codec name, camera
model, IBAN, order number — is wrapped `.ltr-island` or `.numeric`
(unicode-bidi: isolate), or the bidi algorithm drags its punctuation and digits
to the wrong end. "Rec.709" un-isolated renders "709.Rec". Dates and money go in
an inner `.numeric` span, never on a flex container, because flex breaks the
isolation.

## Layout

Container holds to a tight measure (`.container-tight`, max 1140px) with
`clamp(1.25rem, 5vw, 4rem)` inline padding — content occupies roughly the middle
two-thirds and the margins do the work. Public marketing pages alternate
full-bleed section grounds (paper → card → gold tint) so the scroll reads as a
sequence of held frames rather than one column. Dense work surfaces (studio,
admin) use the wider container and prioritise rows over margin. Direction is RTL
by default; spacing is authored with logical properties (`ms/me/ps/pe`,
`start/end`) so nothing is hand-mirrored.

## Elevation & Depth

Mostly flat, with two soft shadows for genuinely floating surfaces. Depth is
carried by tonal layering — paper → card → muted — far more than by shadow.

### Shadow Vocabulary
- **soft** (`0 1px 2px hsl(240 12% 9% / .06), 0 8px 24px -12px hsl(240 12% 9% / .25)`): Cards at rest.
- **lift** (`0 2px 4px …/.08, 0 20px 40px -16px …/.4`): Dialogs, sheets, popovers.
- **glow** (`0 0 0 1px hsl(gold / .35), 0 12px 32px -12px hsl(gold / .45)`): The one primary CTA only.

### Named Rules
**The Tonal-Depth Rule.** Prefer stepping the surface tone (paper → card → muted)
over adding a shadow. Shadows are for things that genuinely float; a raised
panel just changes ground.

## Shapes

Soft, consistent corners: `--radius` 10px on cards, 8px on controls, 6px on
small chips. One exception, and it is deliberate: the **price chip** is the only
fully-rounded (pill) element on a card, so the eye lands on the number. The
second recurring shape is the **letterbox** — a 2.39:1 crop that stands in for
the reference's pointed arch. It is Laqta's own geometry, the literal aspect of
the product, and it recurs on hero crops, empty states and posters.

## Components

### Buttons
- **Shape:** 8px radius (`--radius` − 2).
- **Primary (`gold`):** gold fill, ink text, `shadow-glow`. One per screen —
  the buy button, the submit. Everything else steps down.
- **Default:** gold fill, used where there is no competing primary.
- **Outline / Ghost:** transparent, foreground text, hairline border; hover
  lifts the border to `foreground/25` — never to gold.
- **Hover / Focus:** colour transition only; focus-visible shows a 2px gold ring
  offset from the background.

### Chips
- **Price chip:** gold-tint fill (`gold/12`), gold text, **pill** — the only
  fully rounded element on a card.
- **Filter chip:** hairline border; selected takes a gold border + `gold/15`
  fill; Latin values (codec, aspect) carry `.ltr-island`.

### Cards / Containers
- **Corner:** 10px. **Background:** card (#FFFFFF). **Border:** hairline
  `border`. **Shadow:** `soft` at rest. **Padding:** 24px.
- Hover lifts the border to `foreground/25` and scales any image inside; the
  title never changes colour.

### Inputs / Fields
- **Style:** background fill, hairline border, 8px radius, `text-start`.
- **Focus:** 2px gold ring, offset. **Error:** `aria-invalid` border →
  destructive.
- Fields whose content is always Latin (email, phone, IBAN, VAT) set `dir="ltr"`
  even on an RTL page.

### Navigation
- **Header:** sticky, paper/85 with backdrop-blur, gold wordmark (Serif Display).
- **Active state:** gold text; hover is neutral (`accent` fill), never gold.
- **Mobile:** drawer from the inline-start edge (right in RTL).

## Do's and Don'ts

### Do:
- **Do** keep gold for money, the one primary action, and active state. Well
  under 15% of a screen.
- **Do** set page titles in Serif Display, editorial prose in Serif Text, and
  every control in Sans.
- **Do** use the two-weight headline where copy splits on a comma.
- **Do** wrap every Latin run inside Arabic in `.ltr-island` / `.numeric`, and
  put dates/money in an inner numeric span, never on a flex element.
- **Do** reach for a tonal step (paper → card → muted) before a shadow.
- **Do** use the letterbox (2.39:1) for hero crops and empty states.

### Don't:
- **Don't** put gold on hover borders, heading hovers, non-price text, or stat
  figures that aren't money.
- **Don't** introduce a second accent hue or a gradient; the palette is five
  earth values plus status.
- **Don't** force 16:9 on a clip whose real aspect is 9:16 — it lies about the
  product.
- **Don't** use `left`/`right` or `ml`/`mr`; logical properties only, or RTL
  breaks.
- **Don't** let a status colour (oasis/clay/destructive) become a brand accent.
- **Don't** put `.dark` on `<html>` or on a chrome surface. It marks a film
  frame and nothing else.
- **Don't** hard-code `text-ink` on a gold fill — use `text-gold-foreground`,
  which flips with the ground.
- **Don't** ship a headline in Sans or a data table label in Serif Display.
