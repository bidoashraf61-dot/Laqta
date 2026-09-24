import { Eye } from 'lucide-react'
import type { SessionImpersonation } from '@/lib/auth.config'
import { IMPERSONATION_END_PATH } from '@/lib/impersonation-shared'
import { UserText } from '@/components/ui/bilingual'
import { formatDateTime, t } from '@/lib/i18n'

/**
 * The view-as-user bar. Rendered by the root layout on every page while a
 * view is active, so there is no route on which an admin can forget whose
 * account they are in.
 *
 * Pinned to the bottom edge rather than the top: the site header and both
 * dashboard shells are sticky at the top, and a second sticky bar there would
 * either cover them or be covered. The warning hue is the Status-Only Colour
 * Rule doing its job — this is a state that demands the eye, not decoration.
 *
 * "End" is a plain form POST to the one path middleware lets a view write to,
 * so it works without JavaScript and cannot be swallowed by the client router.
 */
export function ImpersonationBanner({ view }: { view: SessionImpersonation }) {
  return (
    <>
      {/* Keeps the last line of every page clear of the fixed bar. */}
      <div aria-hidden className="h-24 sm:h-16" />
      <div
        role="status"
        data-impersonation-banner
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-warning-foreground/20 bg-warning text-warning-foreground shadow-lift"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <Eye className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {t('account.impersonatingAs')}{' '}
                <UserText>{view.targetName}</UserText>
              </p>
              <p>
                {t('account.impersonationReadOnly')}{' '}
                {t('account.impersonationEnds')}{' '}
                {/* <bdi>, not `.numeric`: the Arabic time carries «ص/م» and a
                    comma, and forcing it LTR reorders it. Isolated, auto
                    direction, it reads correctly in both languages. */}
                <bdi>{formatDateTime(view.expiresAt)}</bdi>
              </p>
            </div>
          </div>
          <form method="post" action={IMPERSONATION_END_PATH}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-md border border-warning-foreground/70 px-4 text-sm font-semibold transition-colors hover:bg-warning-foreground hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-warning"
            >
              {t('account.impersonationEnd')}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
