import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import { inter, jetBrainsMono } from '@/lib/fonts';
import { NextIntlClientProvider } from 'next-intl';
import ClientLayout from './client-layout';
import { isDevEnv } from '@/auth';

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
