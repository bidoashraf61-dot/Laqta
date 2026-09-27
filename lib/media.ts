/**
 * The one place a public media key becomes a URL.
 *
 * Every poster, clip preview, album trailer and the hero film goes through
 * `mediaUrl()`. Nothing renders a key directly, and nothing hand-rolls a
 * `startsWith('/')` check — that check used to live in five places, and the
 * next storage change would have had to find all of them.
 *
 * ── The three kinds of key ──────────────────────────────────────────────────
 *   · `/hero/06-alula.jpg`       rooted at "/" → a file under `public/`. The dev
 *                                seed and the committed posters use these; they
 *                                are served as-is, CDN or not.
 *   · `previews/<clip>.mp4`      a key in the PUBLIC media bucket → the
 *                                CloudFront URL when `NEXT_PUBLIC_MEDIA_CDN_URL`
 *                                is set, otherwise `null`.
 *   · `https://<cdn>/…`          an already-resolved URL → passed through only
 *                                when it is on the configured CDN origin.
 *
 * `null` is the honest answer. A caller that gets `null` keeps its poster (or
 * its still, or its placeholder) and never renders a `<video>` with a src that
 * will 404 — a black box with a dead play button reads as a broken product,
 * where a still reads as a still.
 *
 * ── Why the private prefixes are refused here too ───────────────────────────
 * Masters and editing proxies live in a different, private bucket and are
 * only ever reached through `/api/download` (`lib/storage.ts`). Resolving
 * `masters/…` against the public CDN would merely 404 — but refusing it by
 * name means no caller can ever even ASK for a public URL to the product.
 *
 * Isomorphic on purpose: the hero and the grids are client components, so
 * this reads only a `NEXT_PUBLIC_` variable (inlined at build time) and
 * imports nothing from Node.
 */

const PRIVATE_PREFIXES = ['masters/', 'proxies/', 'documents/', 'albums/']

export function mediaCdnBase(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_CDN_URL ?? '').trim().replace(/\/+$/, '')
}

export function mediaCdnConfigured(): boolean {
  return /^https?:\/\//.test(mediaCdnBase())
}

export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null
  const value = key.trim()
  if (!value) return null

  // A file under public/. `//host` is protocol-relative, not rooted — refuse it.
  if (value.startsWith('/')) return value.startsWith('//') ? null : value

  const base = mediaCdnBase()

  if (/^https?:\/\//i.test(value)) {
    // Only our own CDN. An arbitrary URL pasted into a trailer field would
    // otherwise put a third party's file — and their tracking — on the page.
    return base && value.startsWith(`${base}/`) ? value : null
  }

  if (!mediaCdnConfigured()) return null
  if (PRIVATE_PREFIXES.some((prefix) => value.startsWith(prefix))) return null
  if (value.includes('..')) return null

  return `${base}/${value
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
}

/**
 * Would `mediaUrl()` accept this as a public media reference — independent of
 * whether a CDN is configured right now? Used to validate what an operator
 * types into a trailer field, so a typo is refused at save time instead of
 * silently producing a still on the storefront.
 */
export function isPublicMediaKey(value: string): boolean {
  const v = value.trim()
  if (!v || v.includes('..')) return false
  if (v.startsWith('/')) return !v.startsWith('//')
  if (/^https?:\/\//i.test(v)) {
    const base = mediaCdnBase()
    return Boolean(base) && v.startsWith(`${base}/`)
  }
  if (PRIVATE_PREFIXES.some((prefix) => v.startsWith(prefix))) return false
  return /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(v)
}

/**
 * Where the pipeline puts things in the media bucket. `scripts/media-*.ts`
 * writes these and the app reads them back, so they are named once.
 */
export const MEDIA_KEYS = {
  /*
   * Versioned names (DEV-39): the film is cached for a year, so a new encode
   * must be a new name — bump `-v2` → `-v3` here, in the upload script, and
   * in the file names, never overwrite.
   */
  heroDesktop: 'hero/hero-web-v2.mp4',
  heroMobile: 'hero/hero-web-m-v2.mp4',
  preview: (clipSlug: string) => `previews/${clipSlug}.mp4`,
  poster: (clipSlug: string) => `posters/${clipSlug}.jpg`,
  trailer: (albumSlug: string) => `trailers/${albumSlug}.mp4`,
} as const

/**
 * The hero film: the CDN copy when one is configured, the local staged file
 * otherwise. The local file is gitignored and exists only on the owner's
 * machine, which is exactly why a deploy needs the CDN.
 */
export function heroFilmUrl(mobile: boolean): string {
  const key = mobile ? MEDIA_KEYS.heroMobile : MEDIA_KEYS.heroDesktop
  const local = mobile ? '/hero/vid/hero-web-m-v2.mp4' : '/hero/vid/hero-web-v2.mp4'
  return mediaCdnConfigured() ? (mediaUrl(key) ?? local) : local
}
