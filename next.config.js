/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['qdxlqtkrhnwhsfihnljc.supabase.co'],
  },
  // Disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false
}

module.exports = nextConfig
