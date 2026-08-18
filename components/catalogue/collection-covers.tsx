'use client'

import * as React from 'react'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'

/**
 * The covers of the albums inside a collection, cycling.
 *
 * ── Why a slideshow and not a montage ───────────────────────────────────────
 * The card carried its collection's `heroMedia` at 25% opacity behind the text,
 * which said "there is a picture here" without letting anyone see one. A
 * collection is a shelf, and the only honest preview of a shelf is what is
 * actually on it — so this shows the album covers themselves.
 *
 * A crossfade rather than a grid of four thumbnails because a grid at card size
 * gives each cover ~70px, which is smaller than the watermark on it. One frame
 * at a time is legible; four are decoration.
 *
 * ── The things a cycling image usually gets wrong ───────────────────────────
 * It never animates under `prefers-reduced-motion` — an image that changes on
 * its own is precisely what that preference is about — and it does not run
 * while the tab is hidden, because a timer redrawing an offscreen card is pure
 * battery. With one cover, or none, nothing cycles at all.
 *
 * Decorative: the collection's title and count are the real content, and they
 * are text beside this. Announcing five album covers would be noise.
 */
export function CollectionCovers({ covers, className }: { covers: string[]; className?: string }) {
  const t = useT()
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    if (covers.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => {
      // Slow. This is ambient, and anything quick enough to catch the eye is
      // quick enough to compete with the rest of a page full of cards.
      timer = setInterval(() => setIndex((current) => (current + 1) % covers.length), 3800)
    }
    const stop = () => clearInterval(timer)

    const onVisibility = () => (document.hidden ? stop() : start())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [covers.length])

  if (covers.length === 0) {
    return (
      <div
        className={cn('grid place-items-center bg-gradient-to-br from-ink to-secondary', className)}
      >
        <span className="font-display text-2xl font-bold text-gold/25">{t('brand.name')}</span>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-ink', className)}>
      {covers.map((cover, position) => (
        <img
          key={cover}
          src={cover}
          alt=""
          aria-hidden
          loading="lazy"
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-frame ease-cut',
            position === index ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      <PreviewWatermark label={`${t('brand.name')} · ${t('catalogue.preview')}`} />
    </div>
  )
}
