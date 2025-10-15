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
  },
  compiler: {
    styledComponents: true,
  },
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone',
  // AGGRESSIVE: Create as few chunks as possible to avoid university rate limiting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Disable code splitting as much as possible
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 3, // Reduce parallel requests
          maxAsyncRequests: 3,
          minSize: 100000, // Larger minimum chunk size (100kb)
          cacheGroups: {
            default: false,
            vendors: false,
            // Single vendor bundle
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            // Single common bundle
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
        runtimeChunk: false, // Disable runtime chunk splitting
      };
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
