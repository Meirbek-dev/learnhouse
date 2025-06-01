import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/umami/script.js',
        destination: 'https://eu.umami.is/script.js',
      },
      {
        source: '/umami/api/send',
        destination: 'https://eu.umami.is/api/send',
      },
    ]
  },
  experimental: {
    reactCompiler: true,
    ppr: true,
  },
  compiler: {
    styledComponents: true,
  },
  reactStrictMode: false,
  output: 'standalone',
}

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
