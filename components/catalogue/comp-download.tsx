import { Download } from 'lucide-react'
import { Link } from '@/components/ui/link'
import { buttonVariants } from '@/components/ui/button'
import { formatNumber, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { compLimits } from '@/lib/previews'

/**
 * «حمّل المعاينة» — the comp download.
 *
 * A signed-in visitor downloads the watermarked 720p preview (one clip, or the
 * whole album as a ZIP) to cut into their own timeline before buying. The
 * control says what the file is in the same breath as offering it —
 * watermarked, 720p, for testing — so no one mistakes it for the product, and
 * says where the licence comes from.
 *
 * ── Why a plain <a> to the route, no `download` attribute ───────────────────
 * The route answers with `Content-Disposition: attachment`, so the browser
 * saves the file and the page stays put. On a refusal it REDIRECTS back here
 * with `?comp=…#comps` instead; a `download` attribute would save that
 * redirect's HTML page as a file rather than following it.
 *
 * Outline, never gold: the buy button is the one gold action on the page
 * (One Voice Rule). This is the step before it, not a rival to it.
 */

export type CompNotice = 'limit' | 'unavailable' | null

export function compNotice(value: string | undefined): CompNotice {
  return value === 'limit' || value === 'unavailable' ? value : null
}

const RESOLUTION = '720p'

/**
 * A message with `{res}` rendered as an LTR-isolated «720p» — a Latin run
 * inside Arabic otherwise reorders to «p720».
 */
function WithResolution({ text }: { text: string }) {
  const parts = text.split('{res}')
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? <span className="numeric">{RESOLUTION}</span> : null}
          {part}
        </span>
      ))}
    </>
  )
}

export function CompDownload({
  kind,
  targetId,
  back,
  signedIn,
  notice,
  fileCount,
  className,
}: {
  kind: 'clip' | 'album'
  /** Clip id or album id. */
  targetId: string
  /** This page's own path, WITH its locale prefix — where refusals return. */
  back: string
  signedIn: boolean
  notice: CompNotice
  /** Album only: how many previews the ZIP will carry. */
  fileCount?: number
  className?: string
}) {
  const album = kind === 'album'
  const href = `${album ? `/api/preview/album/${targetId}` : `/api/preview/${targetId}`}?back=${encodeURIComponent(back)}`
  const button = cn(buttonVariants({ variant: 'outline' }), 'w-full gap-2 whitespace-normal text-center')

  return (
    <div id="comps" className={cn('scroll-mt-28 space-y-2', className)}>
      {signedIn ? (
        <a href={href} className={button} rel="nofollow">
          <Download className="size-4 shrink-0" aria-hidden />
          {album ? t('catalogue.compDownloadAll') : t('catalogue.compDownload')}
        </a>
      ) : (
        // Back to this page after sign-in, prefix and all — the visitor
        // clicks again with a session, rather than being dropped on a
        // download they did not see start.
        <Link href={`/sign-in?callbackUrl=${encodeURIComponent(back)}`} className={button} rel="nofollow">
          <Download className="size-4 shrink-0" aria-hidden />
          {album ? t('catalogue.compSignInAll') : t('catalogue.compSignIn')}
        </Link>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        <WithResolution
          text={
            album
              ? t('catalogue.compNoteAlbum', { count: formatNumber(fileCount ?? 0), res: '{res}' })
              : t('catalogue.compNote', { res: '{res}' })
          }
        />
      </p>

      {notice ? (
        <p role="status" className="text-xs font-medium leading-relaxed text-warning">
          {notice === 'limit'
            ? album
              ? t('catalogue.compLimitAlbum', { limit: formatNumber(compLimits().zipsPerDay) })
              : t('catalogue.compLimit', { limit: formatNumber(compLimits().clipsPerHour) })
            : t('catalogue.compUnavailable')}
        </p>
      ) : null}
    </div>
  )
}
