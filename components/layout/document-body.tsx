import type { DocumentSection } from '@/components/layout/document-page'
import type { Locale } from '@/lib/locale'
import { cn } from '@/lib/utils'

/**
 * The sections of a long-form page, in one language.
 *
 * Takes the locale as a prop instead of reading the render's store, so the
 * same markup renders on the public page (server) and in the admin editor's
 * live preview (client, either language) — the preview is the page, not an
 * imitation of it (DEV-64a).
 *
 * `variant="guide"` is the smaller form `/contact` uses beside its form:
 * sans subheads, no bullet lists.
 *
 * Keys are indexes, not text: an editor can produce two identical paragraphs,
 * and a duplicate key would drop one of them silently.
 */
export function DocumentBody({
  sections,
  locale,
  variant = 'page',
  className,
}: {
  sections: DocumentSection[]
  locale: Locale
  variant?: 'page' | 'guide'
  className?: string
}) {
  const pick = <T,>(ar: T, en: T | undefined): T => {
    if (locale !== 'en' || en == null) return ar
    if (typeof en === 'string' && en.length === 0) return ar
    if (Array.isArray(en) && en.length === 0) return ar
    return en
  }

  if (variant === 'guide') {
    return (
      <div className={cn('space-y-7', className)}>
        {sections.map((section, index) => (
          <section key={index}>
            <h3 className="font-sans text-base font-medium">{pick(section.heading, section.headingEn)}</h3>
            {pick(section.body, section.bodyEn).map((paragraph, i) => (
              <p key={i} className="mt-1.5 font-serif leading-[1.85] text-foreground/75">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-10', className)}>
      {sections.map((section, index) => {
        const list = section.list ? pick(section.list, section.listEn) : []
        return (
          <section key={index}>
            <h2 className="font-subhead text-xl font-bold">{pick(section.heading, section.headingEn)}</h2>
            {pick(section.body, section.bodyEn).map((paragraph, i) => (
              <p key={i} className="mt-3 font-serif leading-[1.9] text-foreground/85">
                {paragraph}
              </p>
            ))}
            {list.length ? (
              <ul className="mt-4 space-y-2">
                {list.map((item, i) => (
                  <li
                    key={i}
                    className="relative ps-5 font-serif leading-[1.9] text-foreground/85 before:absolute before:start-0 before:top-[0.85em] before:size-1.5 before:rounded-full before:bg-gold"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
