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

  // Enough repeats to blanket a 16:9 card at any size; the wrapper clips them.
  const marks = Array.from({ length: 48 })
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
