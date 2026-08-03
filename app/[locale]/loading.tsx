import { LoadingState } from '@/components/ui/state'
import { getTranslator, defaultLocale } from '@/lib/i18n'

export default function LocaleLoading() {
  const t = getTranslator(defaultLocale)
  return (
    <div className="container py-20">
      <LoadingState label={t('state.loading')} />
    </div>
  )
}
