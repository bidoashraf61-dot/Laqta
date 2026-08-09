import { LoadingState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export default async function GlobalLoading() {
  // The Suspense fallback is streamed ahead of the layout it sits inside, in
  // its own render — so it has to resolve the locale itself rather than inherit
  // it. Without this the first thing an English visitor sees is Arabic.
  await requestLocale()

  return (
    <div className="container py-20">
      <LoadingState label={t('state.loading')} />
    </div>
  )
}
