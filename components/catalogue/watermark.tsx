import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * Preview watermark.
 *
 * Every frame a non-buyer sees is watermarked — that is the whole deal of a
 * stock library: the preview proves the shot without giving away a usable
 * master. It is applied automatically to every preview surface (clip
 * thumbnails, album covers, the clip/album preview players) rather than baked
 * into the poster files, so one component guarantees no preview can ship
 * un-marked. The purchased download is served clean from storage; this never
 * touches it.
 *
 * A tiled diagonal wordmark at low opacity: legible enough to deter a
 * screen-grab-and-ship, light enough to read the footage under it. Purely
 * decorative and non-interactive, so it is `aria-hidden` and passes clicks
 * through to the media beneath.
 */
export function PreviewWatermark({ className, label }: { className?: string; label?: string }) {
  /*
   * ⚠️ A CLIENT component must pass `label`.
   *
   * The default below calls the server `t()`, which is correct in a server
   * component and silently wrong inside a client one: SSR of a client
   * component is a second React render that does not share the RSC `cache()`
   * scope, so `t()` falls back to Arabic. Adding this overlay to the hero and
   * the two players — all client components — put «لقطة · معاينة» on every
   * English page and failed `verify:arabic` on /en immediately.
   *
   * Client call sites read `useT()` themselves and pass the result:
   *   const t = useT()
   *   <PreviewWatermark label={`${t('brand.name')} · ${t('catalogue.preview')}`} />
   *
   * A prop rather than making this a client component, because it is rendered
   * on every card in every grid; a client boundary per card would hydrate
   * hundreds of decorative spans to no purpose.
   */
  const text = label ?? `${t('brand.name')} · ${t('catalogue.preview')}`

  /*
   * Twelve, not forty-eight.
   *
   * ── Why this number matters far more than it looks ──────────────────────
   * This overlay is drawn on every card, every grid tile, every player. The
   * landing page carries 29 of them, so at 48 repeats each it was putting
   * **1,392 spans** on the page — 64% of the document's entire node count,
   * for decoration.
   *
   * Chrome absorbs that. WebKit does not: measured on the same page, Safari
   * scrolled at a median of 323ms per frame — about three frames per second —
   * against Chrome's 16.7ms. Cutting the repeats fixed it outright, back to
   * 17ms.
   *
   * It is the NODE COUNT, not the drop-shadow: removing the filter and keeping
   * 1,392 spans changed nothing (334ms), while keeping the filter and cutting
   * the spans gave the whole improvement.
   *
   * Twelve still blankets the largest surface this is used on, because the
   * row wraps and the -25% inset over-hangs the frame on every side.
   */
  const marks = Array.from({ length: 12 })
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-[1] select-none overflow-hidden',
        className,
      )}
    >
      <div className="absolute inset-[-25%] flex rotate-[-24deg] flex-wrap content-center items-center justify-center gap-x-8 gap-y-6 opacity-[0.16]">
        {marks.map((_, index) => (
          <span
            key={index}
            className="whitespace-nowrap font-display text-xs font-bold tracking-[0.2em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
