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
      const existingOptimization = config.optimization ?? {};
      const existingSplitChunks = existingOptimization.splitChunks ?? {};

      config.optimization = {
        ...existingOptimization,
        runtimeChunk: 'single',
        splitChunks: {
          ...existingSplitChunks,
          chunks: 'all',
          // Aggressively flatten chunks so initial load performs a handful of requests.
          maxAsyncRequests: 4,
          maxInitialRequests: 2,
          minSize: 150_000,
          enforceSizeThreshold: 500_000,
          minRemainingSize: 0,
          maxSize: 1_200_000,
          cacheGroups: {
            default: false,
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: -10,
              enforce: true,
            },
            framework: {
              test: /[\\/]node_modules[\\/](@?next|react|react-dom)[\\/]/,
              name: 'framework',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            uiBundle: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|recharts)[\\/]/,
              name: 'ui-bundle',
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
          },
        },
      };

      if (LimitChunkCountPlugin) {
        config.plugins = config.plugins ?? [];
        config.plugins.push(
          new LimitChunkCountPlugin({
            maxChunks: 18,
          }),
        );
      }
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
