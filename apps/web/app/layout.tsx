import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import ClientLayout from './client-layout';
import { isDevEnv } from '@/auth';
import Script from 'next/script';
import { inter, jetBrainsMono } from '@/lib/fonts';

import '../styles/globals.css';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      className={`${inter.variable} ${jetBrainsMono.variable}`}
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
        <NextIntlClientProvider
          messages={messages}
          locale={locale}
          now={new Date()}
        >
          <ClientLayout>{children}</ClientLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
