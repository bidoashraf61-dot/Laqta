'use client'

import { useEffect, useRef, useState } from 'react'
import { SCENES, CONNECTORS } from './scenes'
import { t } from '@/lib/i18n'
import { Eyebrow, Headline, Prose } from '@/components/ui/typography'

/**
 * The scroll-scrubbed hero.
 *
 * Not WebGL and not a scroll library: a pre-rendered flight whose playhead is
 * driven by scroll position, the same technique Apple uses on product pages.
 * Scroll down and the camera flies forward; stop and it freezes; scroll up and
 * it flies backward.
 *
 * The engine is loaded with a dynamic `import()` inside the effect so its ~29KB
 * and its injected CSS stay out of the server render and off the critical path
 * — the poster for scene one is a plain <img> below, so first paint never waits
 * on any of this.
 */
export function HeroCinematic() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false

    // `prefers-reduced-motion` is honoured by not mounting at all. The engine
    // has its own reduced-motion path, but the static fallback below is a
    // better answer than a scroll-driven scene that refuses to move.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    import('./scroll-world.js')
      .then(({ mountScrollWorld }) => {
        if (disposed || !containerRef.current) return
        mountScrollWorld(containerRef.current, {
          // No `brand` and no `nav`: the site header already carries both, and
          // the engine's fixed top bar renders straight through it.
          cta: { label: t('landing.browseAlbums'), href: '/albums' },
          hint: t('landing.scrollHint'),
          diveScroll: 1.35,
          connScroll: 0.9,
          crossfade: 0.1,
          nav: false,
          atmosphere: true,
          sections: SCENES,
          connectors: CONNECTORS,
        })
        setMounted(true)
      })
      .catch((error) => {
        // A failed engine load must not take the page with it — the static
        // fallback stays on screen and everything below still works.
        console.error('hero cinematic failed to mount', error)
      })

    return () => {
      disposed = true
    }
  }, [])

  return (
    <section aria-label={t('landing.heroLabel')}>
      <div ref={containerRef} />

      {/* Server-rendered fallback: the real first frame, the real headline.
          It is what reduced-motion users, crawlers and anyone whose JS has not
          arrived yet actually see, so it carries the h1 rather than a spinner. */}
      {mounted ? null : <HeroFallback />}
    </section>
  )
}

function HeroFallback() {
  const first = SCENES[0]
  const finale = SCENES[SCENES.length - 1]

  return (
    <div className="relative isolate flex min-h-[80vh] items-center overflow-hidden">
      <img
        src={first.still}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 size-full object-cover opacity-60"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />

      <div className="container-tight space-y-6 py-28">
        <Eyebrow>{first.eyebrow}</Eyebrow>
        {/* The hero headline splits on its comma into the Light/Bold pair. */}
        <Headline
          as="h1"
          size="display"
          lead={first.title?.split('،')[0] ? `${first.title.split('،')[0]}،` : undefined}
          bold={first.title?.split('،').slice(1).join('،').trim() || first.title}
          className="max-w-3xl"
        />
        <Prose className="max-w-xl">{first.body}</Prose>
        <ul className="flex flex-wrap gap-2">
          {(first.tags ?? []).map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold"
            >
              {tag}
            </li>
          ))}
        </ul>
        <p className="sr-only">{finale.body}</p>
      </div>
    </div>
  )
}
