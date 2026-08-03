/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
