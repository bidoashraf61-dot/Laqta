import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { requestLocale } from '@/lib/locale-request'

/**
 * Never in a search index (DEV-33): a shared board is a private link, and the
 * forbidden page renders in place of a guarded one.
 */
export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  // A description even on a private page (DEV-38): a board link pasted into
  // WhatsApp otherwise previews as the site's generic promise.
  return { description: t('brand.seo.forbidden'), robots: { index: false, follow: false } }
}

/**
 * 403. middleware.ts *rewrites* here rather than redirecting, so the URL the
 * user typed stays in the address bar — they can hand it to whoever does have
 * the right role instead of losing it.
 */
export default async function ForbiddenPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  return (
    /*
     * `data-page="forbidden"` is what `verify:auth` matches — NOT the copy.
     *
     * The gate used to look for the literal «لا تملك صلاحية الوصول». An
     * editorial pass changed the title, the match silently missed, and the
     * role-guard matrix reported three blocked pages as "allowed". The guards
     * were fine; the gate had coupled a security check to wording that is
     * supposed to be editable. A marker nobody rewrites cannot drift.
     */
    <div
      data-page="forbidden"
      className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"
    >
      <ShieldAlert className="size-12 text-warning" />
      <PageTitle>{t('state.forbidden')}</PageTitle>
      <p className="max-w-md text-muted-foreground">{t('state.forbiddenHint')}</p>
      <Button asChild variant="outline">
        <Link href="/">{t('state.backHome')}</Link>
      </Button>
    </div>
  )
}
