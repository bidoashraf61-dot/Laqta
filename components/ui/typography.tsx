'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The type system.
 *
 * ── Two-weight headlines ────────────────────────────────────────────────────
 * Lifted from the Al Diaar reference: a headline is set as two lines at the
 * same size, the first Light and the second Bold. It gives a heading internal
 * hierarchy without a second size, a colour or a rule — which is why the
 * reference can hold a page together with almost no other devices.
 *
 *   <Headline lead="لقطات سعودية،" bold="بجودة سينمائية." />
 *
 * Both lines are SERIF DISPLAY — the only cut in the superfamily with real pen
 * modulation, the thick/thin alternation of a broad-nib qalam. That contrast is
 * what makes an Arabic headline read as culture rather than as interface, and
 * it is the reason headlines are not set in Sans: Sans is the flattest cut in
 * the family, correct for a button and wrong for the first thing anyone sees.
 * Falling back to a single-line `<Headline>` is fine when the copy will not
 * split — the pairing is a tool, not a quota.
 *
 * Headlines are set OPEN via `.headline-airy`, which spaces WORDS rather than
 * letters. Arabic is cursive: letter-spacing pries apart glyphs that are meant
 * to join and reads as broken, while word-spacing gives the same generosity
 * with every ligature intact.
 *
 * ── Eyebrow ─────────────────────────────────────────────────────────────────
 * Small, tracked, gold. This is one of the few places gold survives the
 * ration, because it is doing hierarchy work no size change could do at that
 * scale.
 */

export function Headline({
  lead,
  bold,
  children,
  as: Tag = 'h2',
  size = 'headline',
  className,
}: {
  lead?: string
  bold?: string
  children?: React.ReactNode
  as?: 'h1' | 'h2' | 'h3'
  size?: 'display' | 'headline' | 'lg'
  className?: string
}) {
  const scale =
    size === 'display' ? 'text-display' : size === 'headline' ? 'text-headline' : 'text-2xl'

  // The statement line is BOLD (700), not Black (900).
  //
  // Black is where Serif Display stops being a serif: at 900 the thin strokes
  // fatten until the pen contrast that carries the whole cultural read
  // collapses into a slab, and the headline lands back where Sans already was.
  // 700 is the heaviest weight that still shows the modulation. Against the
  // Light (300) lead the jump is four steps — more than enough for the pair to
  // read as one voice dropping to a whisper and then landing.
  //
  // Every size lands on 700, including `lg`. `lg` is what the landing sections
  // use, and a section headline is a statement — stepping it down to Medium
  // made those lines quieter than the prose underneath them. Display's Medium
  // lives in the dashboards instead (see DashboardHeader), where a page title
  // is chrome rather than an argument. Three weights of Display: 300, 500, 700.
  return (
    <Tag
      className={cn(
        'font-display text-balance leading-[1.12]',
        size === 'display' ? 'headline-airy-wide' : 'headline-airy',
        scale,
        className,
      )}
    >
      {lead ? (
        <>
          <span className="block font-light">{lead}</span>
          <span className="block font-bold">{bold}</span>
        </>
      ) : (
        <span className="font-bold">{children ?? bold}</span>
      )}
    </Tag>
  )
}

/**
 * Sub-headline — Serif Text.
 *
 * One step below a Headline: the editorial voice that introduces a section or
 * carries a pull-quote. It is deliberately NOT Serif Display. Two cuts of the
 * same serif stacked at neighbouring sizes read as one font rendered badly —
 * the reader sees a size change and a mismatch rather than a hierarchy. Serif
 * Text is a genuinely different drawing: lower contrast, wider counters, cut to
 * survive small. Under a Display headline it reads as the same voice speaking
 * more quietly, which is what a sub-head is for.
 *
 * `weight` opens the family's range rather than pinning one cut: `quiet` (300)
 * for a long lead-in that must not compete, `medium` (500) as the default, and
 * `strong` (700) when the sub-head is carrying the section on its own.
 */
export function SubHeadline({
  children,
  as: Tag = 'h3',
  size = 'section',
  weight = 'medium',
  className,
}: {
  children: React.ReactNode
  as?: 'h2' | 'h3' | 'h4' | 'p'
  size?: 'section' | 'panel' | 'card'
  weight?: 'quiet' | 'medium' | 'strong'
  className?: string
}) {
  // Three rungs, all documented steps on the ramp: `section` introduces a
  // full-bleed band, `panel` heads a column on a detail page, `card` titles an
  // item inside a grid.
  const scale = size === 'section' ? 'text-subhead' : size === 'panel' ? 'text-xl' : 'text-lg'
  const cut = weight === 'quiet' ? 'font-light' : weight === 'strong' ? 'font-bold' : 'font-medium'

  return (
    <Tag className={cn('font-subhead text-foreground/90', scale, cut, className)}>{children}</Tag>
  )
}

/** Small tracked label above a headline. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-sm font-medium tracking-[0.14em] text-gold', className)}>{children}</p>
  )
}

/**
 * Editorial body copy — Serif Text.
 *
 * Deliberately narrow (`max-w-prose`) and only slightly above base size. In the
 * reference, body copy is texture rather than reading matter; the image and the
 * headline carry the page.
 */
export function Prose({
  children,
  size = 'base',
  className,
}: {
  children: React.ReactNode
  size?: 'base' | 'lg'
  className?: string
}) {
  // Bigger than before, and tinted from the foreground rather than muted, so a
  // description reads as something to be read — not texture under the headline.
  //
  // The two sizes take different weights, because they are doing different
  // jobs. `lg` is a lead paragraph sitting directly under a headline: at that
  // size Regular is already dense, and Light (300) is what lets a large serif
  // stay airy instead of turning into a grey slab. `base` is running text and
  // holds Regular (400), the weight the face was drawn for.
  return (
    <div
      className={cn(
        'max-w-prose font-serif leading-[1.85] text-foreground/75',
        size === 'lg' ? 'text-[1.35rem] font-light leading-[1.75]' : 'text-[1.2rem] font-normal',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Section wrapper with an alternating ground.
 *
 * The reference reads as a sequence of held frames rather than one continuous
 * column, and it achieves that purely by alternating the background between
 * full-bleed panels. `tone` is the only knob.
 */
export function Section({
  tone = 'base',
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  tone?: 'base' | 'raised' | 'warm' | 'accent' | 'oasis'
}) {
  // The colour-ratio system, activated: the page alternates paper with warm
  // sand grounds (Al Diaar's method — a sequence of held frames, not one flat
  // column). Gold is the money/accent ground; oasis carries the one green
  // "cleared / verified" beat. Each is a full-bleed panel with a hairline in
  // its own hue.
  const ground =
    tone === 'raised' || tone === 'warm'
      ? 'bg-sand/25 border-y border-sand/50'
      : tone === 'accent'
        ? 'bg-gold/[0.07] border-y border-gold/25'
        : tone === 'oasis'
          ? 'bg-oasis/[0.07] border-y border-oasis/25'
          : ''

  return (
    <section className={cn(ground, className)} {...props}>
      <div className="container-tight py-20">{children}</div>
    </section>
  )
}
