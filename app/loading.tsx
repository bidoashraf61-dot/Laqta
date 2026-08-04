import { LoadingState } from '@/components/ui/state'
import { t } from '@/lib/i18n'

export default function GlobalLoading() {
  return (
    <div className="container py-20">
      <LoadingState label={t('state.loading')} />
    </div>
  )
}
