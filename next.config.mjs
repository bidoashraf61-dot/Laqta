/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * The media CDN (`NEXT_PUBLIC_MEDIA_CDN_URL`, see docs/tech/media-aws.md) is
   * already covered by the https wildcard; posters render as plain <img> and
   * previews as <video>, so neither goes through the image optimiser anyway.
   *
   * There is no Content-Security-Policy on this site. If one is added, it must
   * allow the CDN origin in `img-src` and `media-src`, or every poster and
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
      { source: '/fonts/:path*', headers: year },
      { source: '/hero/:path*', headers: year },
    ]
  },
  async redirects() {
    return [
      { source: '/locations', destination: '/footage', permanent: true },
      { source: '/categories', destination: '/footage', permanent: true },
    ]
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
