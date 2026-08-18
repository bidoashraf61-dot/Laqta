import { LOGO } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * The Laqta mark.
 *
 * `tone` names the GROUND it is sitting on, not a theme — the same rule every
 * other paired token in this system follows. A caller that knows it is drawing
 * on ink asks for `dark`; one on paper asks for `light`. Nothing here reads a
 * document theme, because there isn't one any more and because a mark on an
 * album cover sits on film regardless of what the page around it is doing.
 *
 * The artwork is the calligraphic لقطة over the Latin wordmark, so it carries
 * both scripts and needs no localised variant. It is `alt`-labelled with the
 * brand name rather than "logo": a screen reader announcing "logo" tells you
 * the file type, not whose site you are on.
 */
export function Logo({
  tone = 'light',
  className,
}: {
  /** The ground beneath the mark. `dark` = ink/film, `light` = paper. */
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <img
      src={tone === 'dark' ? LOGO.onDark : LOGO.onLight}
      alt={t('brand.name')}
      loading="lazy"
      decoding="async"
      className={cn('h-auto w-auto select-none object-contain', className)}
    />
  )
}
