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
  // ULTRA-AGGRESSIVE: Minimize chunks to absolute minimum for university rate limiting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Almost completely disable code splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 2, // Only 2 initial chunks (main + vendor)
          maxAsyncRequests: 2, // Only 2 async chunks
          minSize: 200000, // Very large minimum chunk size (200kb)
          maxSize: 5000000, // Allow very large chunks (5MB)
          cacheGroups: {
            default: false,
            vendors: false,
            // Single massive vendor bundle containing ALL node_modules
            allVendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors-all',
              chunks: 'all',
              priority: 30,
              enforce: true,
              reuseExistingChunk: true,
            },
            // Everything else in one bundle
            commons: {
              name: 'commons',
              minChunks: 1,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
        runtimeChunk: false, // No runtime chunk
        moduleIds: 'deterministic', // Better caching
      };
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
