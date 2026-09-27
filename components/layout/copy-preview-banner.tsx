'use client'

import { usePathname } from 'next/navigation'
import { PencilLine } from 'lucide-react'
import { useT } from '@/lib/i18n-client'

/**
 * Shown while an admin previews unpublished copy on the real page (DEV-64b).
 * Same place and weight as the view-as-user bar — a page that shows words no
 * visitor can see must never be mistaken for the live one.
 *
 * "End preview" is a plain anchor to the same path without the query: the
 * middleware then renders the published copy.
 */
export function CopyPreviewBanner() {
  const t = useT()
  const pathname = usePathname()

  return (
    <>
      <div aria-hidden className="h-24 sm:h-16" />
      <div
        role="status"
        data-copy-preview-banner
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-warning-foreground/20 bg-warning text-warning-foreground shadow-lift"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-start gap-3 text-sm">
            <PencilLine className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">{t('dash.copy.previewBannerTitle')}</p>
              <p>{t('dash.copy.previewBannerBody')}</p>
            </div>
          </div>
          <a
            href={pathname}
            className="inline-flex min-h-10 items-center rounded-md border border-warning-foreground/70 px-4 text-sm font-semibold transition-colors hover:bg-warning-foreground hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-warning"
          >
            {t('dash.copy.previewBannerEnd')}
          </a>
        </div>
      </div>
    </>
  )
}
