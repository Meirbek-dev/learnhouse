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
      // Reduce chunk splitting to minimize simultaneous requests
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Create larger vendor chunk to reduce total chunks
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
              name: 'vendors',
              enforce: true,
            },
            // Combine common modules
            common: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
              name: 'common',
            },
            // Group UI libraries together
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|recharts)[\\/]/,
              name: 'ui-libs',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
          // Increase minimum size to create fewer, larger chunks
          minSize: 30000,
          maxSize: 244000, // Limit max chunk size
        },
      };
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
