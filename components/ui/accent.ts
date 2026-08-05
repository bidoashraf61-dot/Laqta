/**
 * The palette, activated.
 *
 * The design system rations gold to money, action and active state — but the
 * ratio method it adopts (Al Diaar) still *uses* the rest of the palette:
 * sand as a warm neutral, oasis and clay as signal, each carrying a small
 * share of surface. These are the icon-chip fills for that, so a grid of
 * features reads as a warm, mixed set rather than a column of identical gold
 * badges. Gold stays reserved — it is here for completeness, not for decoration
 * — and a "cleared / verified" idea always takes `oasis`, an "attention" idea
 * always takes `clay`, so colour still means something.
 */

export type Accent = 'gold' | 'oasis' | 'clay' | 'sand' | 'ink'

/** Soft tinted chip — a coloured ground with the same-hue icon on top. */
export const accentChip: Record<Accent, string> = {
  gold: 'bg-gold/12 text-gold',
  oasis: 'bg-oasis/12 text-oasis',
  clay: 'bg-clay/15 text-clay',
  sand: 'bg-sand/50 text-foreground/80',
  ink: 'bg-foreground/8 text-foreground/80',
}

/** Soft full-surface tint — for a tile or card ground that should read warm. */
export const TILE_TINT: Record<Accent, string> = {
  gold: 'bg-gold/[0.08]',
  oasis: 'bg-oasis/[0.08]',
  clay: 'bg-clay/[0.08]',
  sand: 'bg-sand/40',
  ink: 'bg-foreground/[0.05]',
}

/** A rotation for a grid of peers where no single hue carries meaning. */
export const ACCENT_CYCLE: Accent[] = ['gold', 'oasis', 'clay', 'sand']

export const cycleAccent = (index: number): Accent => ACCENT_CYCLE[index % ACCENT_CYCLE.length]
