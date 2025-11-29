import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import { IntlProvider } from '@/components/providers/IntlProvider';
import { inter, jetBrainsMono } from '@/lib/fonts';
import ClientLayout from './client-layout';
import { isDevEnv } from '@/auth';
import { Suspense } from 'react';

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
        {isDevEnv && (
          <script
            crossOrigin="anonymous"
            src="//unpkg.com/react-scan/dist/auto.global.js"
          />
        )}
      </head>
      <body className="bg-background/20">
        <Suspense fallback={null}>
          <IntlProvider
            messages={messages}
            locale={locale}
          >
            <ClientLayout>{children}</ClientLayout>
          </IntlProvider>
        </Suspense>
      </body>
    </html>
  );
}
