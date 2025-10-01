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
    ppr: false,
    reactCompiler: true,
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
    turbo: {
      root: '../../',
    },
  },
  compiler: {
    styledComponents: true,
  },
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone',
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
