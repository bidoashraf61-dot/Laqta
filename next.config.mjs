/**
 * Content-Security-Policy and the other security headers (DEV-48).
 *
 * ── What it allows, and why ─────────────────────────────────────────────────
 *   script-src  'self' + 'unsafe-inline': Next's hydration payload and the
 *               theme script are inline. A nonce would make every page
 *               dynamic; the real protection here is that NO third-party
 *               origin can run script — except Google Tag Manager, for the
 *               analytics decided in D10. 'unsafe-eval' in development only
 *               (React's dev tooling).
 *   img/media   'self', data:/blob:, and the media CDN — posters, previews,
 *               trailers, the hero film.
 *   connect     'self', the CDN (HLS segments), S3 (the studio's multipart
 *               upload PUTs straight to a presigned bucket URL), analytics.
 *   frame-ancestors 'none' — nobody frames Laqta (clickjacking).
 *   form-action 'self' — the Paymob hand-off is a navigation, not a form post.
 *
 * The CDN origin is read from NEXT_PUBLIC_MEDIA_CDN_URL when the server
 * starts; set it before `next build` / `next start`.
 */
function securityHeaders() {
  const dev = process.env.NODE_ENV !== 'production'
  let cdn = ''
  try {
    cdn = process.env.NEXT_PUBLIC_MEDIA_CDN_URL ? new URL(process.env.NEXT_PUBLIC_MEDIA_CDN_URL).origin : ''
  } catch {
    cdn = ''
  }
  const s3 = 'https://*.amazonaws.com'
  const analytics = 'https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${cdn} https://*.google-analytics.com https://www.googletagmanager.com`.trim(),
    `media-src 'self' blob: ${cdn}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${cdn} ${s3} ${analytics}${dev ? ' ws: wss:' : ''}`.replace(/ +/g, ' '),
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
    .map((directive) => directive.replace(/ +/g, ' ').trim())
    .join('; ')
  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * The media CDN (`NEXT_PUBLIC_MEDIA_CDN_URL`, see docs/tech/media-aws.md) is
   * already covered by the https wildcard; posters render as plain <img> and
   * previews as <video>, so neither goes through the image optimiser anyway.
   *
   * The Content-Security-Policy below (DEV-48) allows the CDN origin in
   * `img-src`, `media-src` and `connect-src` — without it every poster and
   * preview breaks at once. (Downloads are top-level navigations redirected
   * by /api/download, which CSP does not govern.)
   */
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  /**
   * `/locations` and `/categories` are gone; both facets live in the shots
   * rail now. The indexes were walls of tiles that, on a launch-scale
   * catalogue, mostly read "0" — pages whose whole job was to advertise how
   * little there is.
   *
   * Done here rather than with `redirect()` in a page for one reason: this
   * emits a real 308 at the edge. A render-time redirect on a statically
   * generated route served the destination's HTML at the ORIGINAL url — a
   * duplicate, which is worse for search than the page it replaced. Verified
   * in a browser: the URL never changed and the status was 200.
   *
   * The individual hubs (`/locations/[slug]`, `/categories/[slug]`) are NOT
   * redirected. They carry ~2,590 words each at sitemap priority 0.9, and
   * sitemap.ts calls them "the main organic differentiator against the global
   * libraries".
   */
  /**
   * Browser caching for the heavy static files (DEV-39). Without these, Next
   * serves `public/` with `max-age=0`, so every visit re-downloaded the hero
   * film, its stills and fifteen font files.
   *
   * A year and `immutable`: these names never change content. The fonts and
   * the hero stills are final; the hero film has versioned names
   * (`hero-web-v2.mp4` — lib/media.ts#MEDIA_KEYS). To replace any of them,
   * give the new file a new name.
   */
  async headers() {
    const year = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
    return [
      // Pages only. Route handlers that answer with a file — a release scan,
      // a licence certificate PDF, a payout export — set their own headers,
      // and a document-level CSP (object-src 'none') can stop Chrome's PDF
      // viewer from opening them.
      { source: '/((?!api/|account/certificates/|en/account/certificates/).*)', headers: securityHeaders() },
      { source: '/fonts/:path*', headers: year },
      { source: '/hero/:path*', headers: year },
    ]
  },
  async redirects() {
    return [
      { source: '/locations', destination: '/footage', permanent: true },
      { source: '/categories', destination: '/footage', permanent: true },
      // The English indexes too (DEV-55: the bilingual audit found them 404ing).
      { source: '/en/locations', destination: '/en/footage', permanent: true },
      { source: '/en/categories', destination: '/en/footage', permanent: true },
    ]
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
