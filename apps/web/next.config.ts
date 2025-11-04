import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

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
    ];
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  compiler: {
    styledComponents: true,
  },
  reactCompiler: true,
  reactStrictMode: true,
  cacheComponents: false,
  devIndicators: false,
  output: 'standalone',
  // Production source maps for better error tracking (enabled for debugging)
  productionBrowserSourceMaps: true,
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Allow cross-origin requests in development
  allowedDevOrigins: [
    'https://cs-mooc.tou.edu.kz',
    'http://192.168.12.35',
    'http://192.168.1.46',
  ],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
