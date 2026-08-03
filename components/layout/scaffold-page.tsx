import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { getTranslator, type Locale } from '@/lib/i18n'

/**
 * Placeholder for a route Foundation guards but does not build.
 *
 * Every one of these disappears when the owning session lands. They exist so
 * the guards, the nav and the shell can be exercised end to end today rather
 * than after five other briefs are done.
 */
export function ScaffoldPage({
  locale,
  title,
  owner,
}: {
  locale: Locale
  title: string
  owner: string
}) {
  const t = getTranslator(locale)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-headline font-semibold">{title}</h1>
        <Badge variant="neutral" className="ltr-island">
          {owner}
        </Badge>
      </div>
      <EmptyState title={t('state.empty')} description={t('state.scaffold')} />
    </div>
  )
}
