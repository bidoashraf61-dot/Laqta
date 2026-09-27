import type { ReactNode } from 'react'
import { formatDate, t } from '@/lib/i18n'
import { PageTitle, Prose } from '@/components/ui/typography'
import { currentLocale } from '@/lib/locale'
import { DocumentBody } from '@/components/layout/document-body'

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
  /**
   * The English side of the same section.
   *
   * Optional rather than required: a document whose translation has not landed
   * yet renders its Arabic on the English page, which is a visible content gap
   * but a working page. Making it required would mean a half-translated policy
   * file fails the build instead.
   */
  headingEn?: string
  bodyEn?: string[]
  listEn?: string[]
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
        <PageTitle>{title}</PageTitle>
        {summary ? (
          <Prose className="mt-5">{summary}</Prose>
        ) : null}
        {effectiveFrom ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t('legal.effectiveFrom')} <span className="numeric">{formatDate(effectiveFrom)}</span>
          </p>
        ) : null}
      </header>

      <DocumentBody sections={sections} locale={currentLocale()} className="max-w-[62ch]" />

      {footer ? <div className="mt-14 max-w-[62ch]">{footer}</div> : null}
    </article>
  )
}
