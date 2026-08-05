import type { ReactNode } from 'react'
import { formatDate, t } from '@/lib/i18n'

/**
 * The document surface.
 *
 * Read mode: the visitor is here to understand something, so the page is
 * structured for comprehension before anything else — one column, prose held
 * to a comfortable measure, headings that survive being skimmed, and a stated
 * effective date, because a policy without one is not a policy.
 *
 * Prose is Serif Text, which is the cut drawn to survive at reading size. The
 * measure is capped in `ch` rather than pixels so it tracks the Arabic glyph
 * width instead of a Latin assumption.
 */

export type DocumentSection = {
  heading: string
  /** Paragraphs. Rendered in order, each its own <p>. */
  body: string[]
  /** Optional bullet list rendered after the paragraphs. */
  list?: string[]
}

export function DocumentPage({
  title,
  summary,
  effectiveFrom,
  sections,
  footer,
}: {
  title: string
  summary?: string
  effectiveFrom?: Date
  sections: DocumentSection[]
  footer?: ReactNode
}) {
  return (
    <article className="container-tight py-16 lg:py-24">
      <header className="mb-12 max-w-[62ch]">
        <h1 className="font-display text-headline font-bold">{title}</h1>
        {summary ? (
          <p className="mt-4 font-serif text-lg leading-relaxed text-muted-foreground">{summary}</p>
        ) : null}
        {effectiveFrom ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t('legal.effectiveFrom')}{' '}
            <span className="numeric">{formatDate(effectiveFrom)}</span>
          </p>
        ) : null}
      </header>

      <div className="max-w-[62ch] space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 font-serif leading-[1.9] text-foreground/85">
                {paragraph}
              </p>
            ))}
            {section.list ? (
              <ul className="mt-4 space-y-2">
                {section.list.map((item) => (
                  <li
                    key={item}
                    className="relative ps-5 font-serif leading-[1.9] text-foreground/85 before:absolute before:start-0 before:top-[0.85em] before:size-1.5 before:rounded-full before:bg-gold"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {footer ? <div className="mt-14 max-w-[62ch]">{footer}</div> : null}
    </article>
  )
}
