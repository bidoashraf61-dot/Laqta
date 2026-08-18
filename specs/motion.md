# Motion — cross-cutting

**Applies to every surface.** The normative tokens and rules are in `DESIGN.md`
(§ Motion); this file records the machinery, the call sites, and what is
deliberately not animated.

## Purpose

Before this, the portal had three easing curves in play — one on the album pack,
one on the hero scroll cue, and Tailwind's default on every `transition-colors`
— with nothing naming any of them, and reduced-motion handled on exactly two of
its animations. Motion was per-component guesswork.

## The machinery

| Piece | File | Rendering |
|---|---|---|
| Tokens (curves, durations, `--rise`, `--stagger-step`) | `styles/globals.css` `:root` | CSS |
| Tailwind names (`duration-move`, `ease-cut`, `animate-rise`, …) | `tailwind.config.ts` | build |
| Reveal state + reduced-motion + print | `styles/globals.css` | CSS |
| Reveal engine | `components/ui/reveal.tsx` (`RevealScope`) | client, mounted once in `app/layout.tsx` |
| Stagger arithmetic | `lib/motion.ts` (`revealDelay`) | server-safe |
| Route-change feedback | `components/layout/route-progress.tsx` | client, mounted once |
| `html.js` marker | `lib/theme.ts` (`THEME_SCRIPT`, inline in `<head>`) | before first paint |

`revealDelay` is in `lib/motion.ts` and **not** in `reveal.tsx`, because the
latter is `'use client'` — a server component importing from it would get a
module proxy rather than a function.

## How a surface opts in

Server components add a bare attribute and ship no JavaScript:

```tsx
<div data-reveal>…</div>
{albums.map((album, i) => <AlbumCard key={album.slug} album={album} index={i} />)}
```

`RevealScope` finds them with one document-wide `IntersectionObserver`, plus a
`MutationObserver` for content that streams in from a Suspense boundary or
arrives on a client-side navigation.

## Where it is applied

| Surface | Element | Stagger |
|---|---|---|
| Every `Section` (landing, `/sell`) | inner container, not the band | no |
| Album grids | `AlbumCard` root | yes, by grid index |
| Clip grids | `ClipCard` root | yes, by grid index |
| Dashboard KPI rows | `StatGrid` | no — the row is one fact |
| Dashboard panels | `Panel` | no |

## Controls retuned onto the scale

| Component | Was | Now |
|---|---|---|
| `Button` | `transition-colors`, default 150ms, no pressed state | named properties, `duration-tap`, `active:scale-[0.99]` |
| `Card` | no hover at all | opt-in `interactive`: border + shadow + inner image scale |
| `Dialog` | centred by transform; `duration-200` | centred by grid; `animate-panel-in` / `animate-panel-out` |
| `Sheet` | 500ms in / 300ms out | `duration-panel` in / `duration-exit` out |
| `Tabs` | `transition-all` | named properties, `duration-tap` |
| `TableRow`, menus, inputs | `transition-colors`, default | `duration-tap` / `duration-move` |

## States

- **No JavaScript** — nothing is hidden. `html.js` is never set, so the reveal
  rules never match and the page renders as plain HTML.
- **`prefers-reduced-motion: reduce`** — every animation and transition in the
  document collapses to 0.01ms (not `none`, so `transitionend` listeners still
  fire). Revealed content resolves to visible immediately. Elements marked
  `data-motion="essential"` are exempt.
- **Print** — all revealed content is forced visible.
- **Observer never fires** — a 2.5s dead-man's switch reveals everything. Gated
  on "never fired at all", not "anything still hidden", so below-the-fold
  content is still allowed to wait.
- **Navigation pending** — a gold hairline sweeps the top of the window after
  140ms, and retires after 8s.

## Invariants

1. Only `opacity` and `transform` are animated. `transition-property` is always
   named — never `transition-all`.
2. No bare timings. Every duration and curve comes from the token scale.
3. Exits are shorter than their entrances.
4. Content is never hidden by default without JavaScript being confirmed first.
5. A reveal is one-way. Nothing re-hides on scroll-out.
6. Reduced motion is handled once, globally — never per component.
7. Nothing overshoots. No bounce, no elastic, no `back.out`.

## Deliberately not animated

- **Page-to-page transitions.** An App Router navigation cannot be interrupted
  cleanly, and a cross-fade delays content that is already fetched. Navigation
  gets a progress hairline instead, which is feedback rather than decoration.
- **The album pack's 3D rotation** — kept as-is, retimed to `--ease-lens`.
- **The hero cinematic** — scroll-driven video, out of scope for this system.
- **Card hover lift.** DESIGN.md defines the card hover as border plus inner
  image scale; a translate was not added.

## Verified by

`npm run audit` (real Chrome, every route, desktop + phone) and
`npm run verify:arabic` both pass. `npm run build` and `npm run lint` are clean.
The reveal engine's failure modes are not yet machine-checked — a gate asserting
"no `[data-reveal]` left hidden after load" would be the natural next step.
