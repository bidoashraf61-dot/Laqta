import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'

/**
 * Placeholder for a route the foundation guards but does not build.
 *
 * Each disappears when the owning session lands. They exist so the guards, the
 * nav and the shell can be exercised today rather than after every brief is
 * finished.
 */
export function ScaffoldPage({ title, owner }: { title: string; owner: string }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>{title}</PageTitle>
        <Badge variant="neutral" className="ltr-island">
          {owner}
        </Badge>
      </div>
      <EmptyState title={t('state.empty')} description={t('state.scaffold')} />
    </div>
  )
}
