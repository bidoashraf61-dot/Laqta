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
     * ── Why the height is what it is ────────────────────────────────────────
     * This was `min-h-[60vh]`, which centred the mark inside 60% of the
     * viewport starting BELOW the sticky header — so it sat noticeably above
     * the optical centre of the screen. `100dvh` minus the header's 4rem puts
     * it in the middle of the space the reader is actually looking at, and
     * `dvh` rather than `vh` so a phone's collapsing address bar does not
     * shift it mid-load.
     *
     * `role="status"` with a polite live region, so a screen reader is told the
     * page is loading once rather than being handed a decorative image. The
     * label rides on the mark's `alt`, which is why there is no visible
     * caption: two announcements of one fact is worse than one.
     */
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-[calc(100dvh-4rem)] place-items-center px-6"
    >
      <LogoMark tone="light" className="h-20 opacity-90" />
      <span className="sr-only">{t('state.loading')}</span>
    </div>
  )
}
