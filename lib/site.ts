/**
 * The public origin of this deployment — the ONE source for every absolute
 * URL the product writes: email links, the sitemap, robots.txt, `metadataBase`
 * (canonical, hreflang, Open Graph), JSON-LD, the Paymob callback and return
 * addresses, and the email-verification link (DEV-40).
 *
 * ── Why this cannot read the request ────────────────────────────────────────
 * Mail is rendered by a background drain, not by a request. There is no host
 * header to read, so a link in an email has to come from configuration. The
 * sitemap and robots.txt are built ahead of any request. And behind a proxy
 * the host header is whatever the proxy says — often an internal name.
 *
 * ── Resolution ──────────────────────────────────────────────────────────────
 *   SITE_ORIGIN → AUTH_URL → NEXTAUTH_URL → (development only) localhost:3000
 *
 * Set SITE_ORIGIN and AUTH_URL together, to the same public https origin.
 * AUTH_URL is what Auth.js builds its own callback links from; SITE_ORIGIN is
 * what everything else uses. Either alone works (each falls back to the
 * other); two different values are warned about, because sign-in links and
 * every other link would then point at different sites.
 *
 * ── Why production fails loud ───────────────────────────────────────────────
 * A wrong origin is worse than a missing one: it produces links that look
 * right and go nowhere, in email nobody can recall, and a sitemap that tells
 * Google the whole site lives on localhost. So a production build or server
 * with neither variable set THROWS instead of guessing. Development (and the
 * verify scripts, which run outside `next`) still get localhost.
 */
const DEV_ORIGIN = 'http://localhost:3000'

let warnedMismatch = false

const clean = (value: string | undefined) => value?.trim().replace(/\/+$/, '') || undefined

export class SiteOriginMissingError extends Error {
  constructor() {
    super(
      '[site] Neither SITE_ORIGIN nor AUTH_URL is set. In production every link in email, ' +
        'the sitemap, canonical tags and payment callbacks would point at localhost. ' +
        'Set both to the public origin, e.g. SITE_ORIGIN="https://laqta.sa" and AUTH_URL="https://laqta.sa".',
    )
    this.name = 'SiteOriginMissingError'
  }
}

/** The configured origin, or null — no fallback, no throw. For checks. */
export function configuredSiteOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return clean(env.SITE_ORIGIN) ?? clean(env.AUTH_URL) ?? clean(env.NEXTAUTH_URL) ?? null
}

export function siteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const site = clean(env.SITE_ORIGIN)
  const auth = clean(env.AUTH_URL) ?? clean(env.NEXTAUTH_URL)

  if (site && auth && site !== auth && !warnedMismatch) {
    warnedMismatch = true
    console.warn(
      `[site] SITE_ORIGIN (${site}) and AUTH_URL (${auth}) differ. Links use SITE_ORIGIN; ` +
        'sign-in callbacks use AUTH_URL. Set them to the same origin.',
    )
  }

  const configured = site ?? auth
  if (configured) return configured

  if (env.NODE_ENV === 'production') throw new SiteOriginMissingError()
  return DEV_ORIGIN
}

/**
 * An absolute URL for a path, in the reader's language.
 *
 * Arabic owns the bare path and English is served under `/en`, so a link built
 * without the locale sends an English reader to an Arabic page.
 */
export function siteUrl(path: string, locale: string = 'ar') {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${siteOrigin()}${locale === 'en' ? `/en${suffix}` : suffix}`
}
