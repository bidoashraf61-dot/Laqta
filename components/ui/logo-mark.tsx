import { LOGO } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * The mark, breathing, for a loading state.
 *
 * ── Why the logo and not a spinner ──────────────────────────────────────────
 * A route transition here can take a beat while a catalogue query runs, and a
 * generic spinner spends that beat saying nothing. The mark says whose site is
 * loading — which is the only information available at that moment, and it is
 * worth something on a first visit.
 *
 * ── Why it pulses rather than spins ─────────────────────────────────────────
 * The artwork is calligraphy. Rotating a wordmark makes it unreadable and, in
 * Arabic, briefly upside down; the letterforms are the asset and they should
 * stay legible while they wait. A slow opacity and scale breath reads as
 * "working" without pretending to measure anything.
 *
 * Marked `data-motion="essential"`: this is the only signal that the page is
 * doing something, and the global reduced-motion reset would otherwise leave a
 * static logo that is indistinguishable from a page that has simply stopped.
 * The animation is deliberately gentle enough to be tolerable at that setting —
 * opacity and scale only, no travel.
 */
export function LogoMark({
  tone = 'light',
  className,
}: {
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <img
      src={tone === 'dark' ? LOGO.onDark : LOGO.onLight}
      alt={t('state.loading')}
      data-motion="essential"
      className={cn('h-auto w-auto animate-mark-breathe select-none object-contain', className)}
    />
  )
}
