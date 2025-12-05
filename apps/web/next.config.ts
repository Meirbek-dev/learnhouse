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
    // Build worker improves parallelism during build but keeps client chunks consolidated
    webpackBuildWorker: true,
    optimizePackageImports: [
      // UI library - tree shaking
      '@radix-ui/react-icons',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-form',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@radix-ui/react-visually-hidden',
      'radix-ui',
      '@icons-pack/react-simple-icons',
      'lucide-react',
      // Heavy utility libs
      'recharts',
      'react-day-picker',
      'date-fns',
      'framer-motion',
      // TipTap editor (heavy)
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/pm',
      '@tiptap/starter-kit',
      '@tiptap/extension-link',
      '@tiptap/extension-image',
      '@tiptap/extension-table',
      '@tiptap/extension-youtube',
      '@tiptap/extension-code-block-lowlight',
    ],
  },
  compiler: {
    styledComponents: true,
  },
  reactCompiler: true,
  reactStrictMode: true,
  cacheComponents: true,
  devIndicators: false,
  output: 'standalone',
  productionBrowserSourceMaps: false,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  allowedDevOrigins: ['https://cs-mooc.tou.edu.kz', 'http://192.168.12.35', 'http://192.168.1.46'],
  images: {
    // Allow using quality 100 for important SVG/brand images while keeping
    // the default smaller quality as fallback.
    qualities: [100, 75],
  },
  // Consolidate client-side chunks to reduce parallel requests on initial load.
  // This helps avoid rate limiting from nginx proxies.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Increase minimum chunk size to reduce number of chunks
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          chunks: 'all',
          // Higher minSize = fewer, larger chunks = fewer parallel requests
          minSize: 50000, // 50KB minimum
          maxAsyncRequests: 10, // Limit concurrent async chunk requests
          maxInitialRequests: 10, // Limit concurrent initial chunk requests
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            // Bundle all UI libraries together
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 30,
              reuseExistingChunk: true,
            },
            // Bundle framer-motion separately (large but often used)
            framer: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer',
              chunks: 'all',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Bundle all form/validation libs together
            forms: {
              test: /[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
              name: 'forms',
              chunks: 'all',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Bundle date utilities together
            dates: {
              test: /[\\/]node_modules[\\/](date-fns|react-day-picker)[\\/]/,
              name: 'dates',
              chunks: 'all',
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
