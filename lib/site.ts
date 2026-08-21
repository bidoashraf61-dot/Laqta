/**
 * The public origin of this deployment.
 *
 * ── Why this cannot read the request ────────────────────────────────────────
 * Mail is rendered by a background drain, not by a request. There is no host
 * header to read, so a link in an email has to come from configuration. Every
 * other absolute URL in the product — the sitemap, JSON-LD, a verification
 * link — has the same problem and should use this.
 *
 * ── Why the fallback is localhost, loudly ───────────────────────────────────
 * A wrong origin is worse than a missing one: it produces links that look
 * right and go nowhere, in email nobody can recall. So an unset variable in
 * production is warned about once, rather than silently guessed at, and the
 * fallback is obviously a development value rather than a plausible domain.
 */
let warned = false

export function siteOrigin() {
  const configured = process.env.SITE_ORIGIN ?? process.env.AUTH_URL
  if (configured) return configured.replace(/\/$/, '')

  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true
    console.warn(
      '[site] SITE_ORIGIN is not set. Links in email and metadata will point at localhost.',
    )
  }
  return 'http://localhost:3000'
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
