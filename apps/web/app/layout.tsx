import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import { filterClientMessages } from '@/lib/i18n-select';
import { NextIntlClientProvider } from 'next-intl';
import ClientProviders from './client-providers';
import { Inter } from 'next/font/google';
import { isDevEnv } from '@/auth';
import Script from 'next/script';

import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export { dynamic, revalidate } from './static-config';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  const rawMessages = await getMessages();
  const messages = filterClientMessages(rawMessages as any);

  return (
    <html
      className={`${inter.variable}`}
      lang={locale}
    >
      <head>
        {/* <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        /> */}
      </head>
      <body>
        {!isDevEnv && (
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id="ba038fd7-d78c-4765-acf2-e5d9cdafba44"
          />
        )}
        <NextIntlClientProvider messages={messages}>
          <ClientProviders>{children}</ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
