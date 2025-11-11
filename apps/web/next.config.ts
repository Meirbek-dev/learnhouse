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
      'framer-motion',
      'recharts',
      'date-fns',
      'react-hook-form',
      'emoji-picker-react',
      'react-day-picker',
      '@floating-ui/dom',
      '@hello-pangea/dnd',
      '@hookform/resolvers',
      '@tiptap/core',
      '@tiptap/extension-bullet-list',
      '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-heading',
      '@tiptap/extension-image',
      '@tiptap/extension-link',
      '@tiptap/extension-list-item',
      '@tiptap/extension-ordered-list',
      '@tiptap/extension-table',
      '@tiptap/extension-table-cell',
      '@tiptap/extension-table-header',
      '@tiptap/extension-table-row',
      '@tiptap/extension-youtube',
      '@tiptap/html',
      '@tiptap/pm',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'artplayer',
      'class-variance-authority',
      'clsx',
      'currency-codes',
      'dompurify',
      'framer-motion',
      'highlight.js',
      'html2canvas-pro',
      'jspdf',
      'jspdf-html2canvas',
      'katex',
      'lowlight',
      'nanoid',
      'next',
      'next-auth',
      'next-intl',
      'nextjs-toploader',
      'prosemirror-state',
      'qrcode',
      'radix-ui',
      're-resizable',
      'react',
      'react-confetti',
      'react-day-picker',
      'react-dom',
      'react-hot-toast',
      'react-katex',
      'react-youtube',
      'recharts',
      'sharp',
      'styled-components',
      'swr',
      'tailwind-merge',
      'tw-animate-css',
      'unsplash-js',
      'zod'
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
