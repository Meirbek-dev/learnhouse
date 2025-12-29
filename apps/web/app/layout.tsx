import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import { IntlProvider } from '@/components/providers/IntlProvider';
import { inter, jetBrainsMono } from '@/lib/fonts';
import ClientLayout from './client-layout';
import DevScriptLoader from '@/components/DevScriptLoader';
import { isDevEnv } from '@/auth';
import { Suspense } from 'react';

import '../styles/globals.css';

async function LocalizedLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <IntlProvider
      messages={messages}
      locale={locale}
    >
      <ClientLayout>{children}</ClientLayout>
    </IntlProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={`${inter.variable} ${jetBrainsMono.variable}`}
      lang="en"
    >
      <head />
      
      {/* Dev-only non-blocking script loader (client-side) */}
      {isDevEnv && <DevScriptLoader />}
      <body className="bg-background/20">
        <Suspense fallback={null}>
          <LocalizedLayout>{children}</LocalizedLayout>
        </Suspense>
      </body>
    </html>
  );
}
