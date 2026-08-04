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
 * Both lines are Serif Display. Falling back to a single-line `<Headline>` is
 * fine when the copy will not split — the pairing is a tool, not a quota.
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

  return (
    <Tag className={cn('font-display text-balance leading-[1.15]', scale, className)}>
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
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-w-prose font-serif text-[1.05rem] leading-[1.9] text-muted-foreground',
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
}: React.HTMLAttributes<HTMLElement> & { tone?: 'base' | 'raised' | 'accent' }) {
  const ground =
    tone === 'raised'
      ? 'bg-card/40 border-y border-border/60'
      : tone === 'accent'
        ? 'bg-gold/[0.06] border-y border-gold/20'
        : ''

  return (
    <section className={cn(ground, className)} {...props}>
      <div className="container-tight py-20">{children}</div>
    </section>
  )
}
