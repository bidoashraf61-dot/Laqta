/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
