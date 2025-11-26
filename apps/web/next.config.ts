import webpack from 'next/dist/compiled/webpack/webpack';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const LimitChunkCountPlugin = (webpack as any)?.optimize?.LimitChunkCountPlugin;

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
  turbopack: { root: './' },
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-form',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@radix-ui/react-visually-hidden',
      '@icons-pack/react-simple-icons',
      'lucide-react',
      'recharts',
      'react-day-picker',
      'date-fns',
    ],
  },
  compiler: {
    styledComponents: true,
  },
  reactCompiler: true,
  reactStrictMode: true,
  cacheComponents: false,
  devIndicators: false,
  output: 'standalone',
  productionBrowserSourceMaps: false,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  allowedDevOrigins: ['https://cs-mooc.tou.edu.kz', 'http://192.168.12.35', 'http://192.168.1.46'],

  // Optimize webpack bundle splitting to reduce number of chunks
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        // For the browser bundle, collapse everything into as few chunks as possible.
        // This trades bundle size for reliability behind strict rate-limited proxies.
        // - No runtime chunk
        // - No splitChunks: each entry gets a single, large bundle
        runtimeChunk: false,
        splitChunks: false,
      };

      if (LimitChunkCountPlugin) {
        config.plugins = config.plugins ?? [];
        config.plugins.push(
          new LimitChunkCountPlugin({
            maxChunks: 12,
          }),
        );
      }
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
