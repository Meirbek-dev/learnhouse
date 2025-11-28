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
  images: {
    // Allow using quality 100 for important SVG/brand images while keeping
    // the default smaller quality as fallback.
    qualities: [100, 75],
  },
  /**
   * Reduce the number of parallel JS chunk requests on initial load.
   *
   * The university nginx in front of this app is very aggressively rate-limiting
   * bursts of requests, including static `.js` assets. By slightly relaxing
   * Webpack's chunk splitting on the client, we trade a bit of caching
   * granularity for fewer, larger bundles – which means fewer concurrent
   * requests and a lower chance of 429 responses for JS chunks on cold loads.
   */
  webpack(config, { isServer }) {
    if (!isServer && config.optimization && config.optimization.splitChunks) {
      const splitChunks = config.optimization.splitChunks;
      // Coerce to any because Next types don't expose all fields cleanly.
      const clientSplitChunks = splitChunks as any;

      clientSplitChunks.maxInitialRequests = Math.min(clientSplitChunks.maxInitialRequests ?? 30, 15);
      clientSplitChunks.maxAsyncRequests = Math.min(clientSplitChunks.maxAsyncRequests ?? 30, 15);
      // Optionally increase minimum size before a separate chunk is created,
      // to avoid overly granular splitting for tiny modules.
      clientSplitChunks.minSize = Math.max(clientSplitChunks.minSize ?? 20_000, 50_000);
    }

    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
