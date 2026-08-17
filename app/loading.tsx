import { LogoMark } from '@/components/ui/logo-mark'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export default async function GlobalLoading() {
  // The Suspense fallback is streamed ahead of the layout it sits inside, in
  // its own render — so it has to resolve the locale itself rather than inherit
  // it. Without this the first thing an English visitor sees is Arabic.
  await requestLocale()

  return (
    /*
     * The brand, waiting.
     *
     * `role="status"` with a polite live region, so a screen reader is told the
     * page is loading once rather than being handed a decorative image. The
     * label is on the mark's `alt`, which is why there is no separate caption:
     * two announcements of the same fact is worse than one.
     */
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-[60vh] place-items-center px-6 py-20"
    >
      <LogoMark tone="light" className="h-20 opacity-90" />
      <span className="sr-only">{t('state.loading')}</span>
    </div>
  )
}
