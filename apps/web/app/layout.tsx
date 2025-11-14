import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import { inter, jetBrainsMono } from '@/lib/fonts';
import { NextIntlClientProvider } from 'next-intl';
import ClientLayout from './client-layout';
import { isDevEnv } from '@/auth';
import Script from 'next/script';

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
        {/* Resource hints for better loading performance */}
        <link
          rel="dns-prefetch"
          href="https://cs-mooc.tou.edu.kz"
        />
        <link
          rel="preconnect"
          href="https://cs-mooc.tou.edu.kz"
          crossOrigin="anonymous"
        />
        <Script
          id="chunk-request-throttler"
          strategy="beforeInteractive"
        >{`(() => {
          if (typeof window === 'undefined') {
            return;
          }

          const registerServiceWorker = () => {
            if (!('serviceWorker' in navigator) || !window.isSecureContext) {
              return;
            }
            const swUrl = '/sw.js';
            navigator.serviceWorker
              .register(swUrl, { scope: '/' })
              .catch((error) => {
                console.error('[sw] registration failed', error);
              });
          };

          try {
            registerServiceWorker();
          } catch (error) {
            console.error('[sw] registration error', error);
          }

          const MAX_PARALLEL_CHUNK_REQUESTS = Number(
            window.__NEXT_MAX_CHUNK_REQUESTS || 3,
          );
          const chunkPattern = /\/_next\/static\/chunks\//;
          const originalHeadAppendChild = window.HTMLElement.prototype.appendChild;
          const taskQueue = [];
          let active = 0;

          const enqueue = (element, context) => {
            taskQueue.push({ element, context });
            drain();
          };

          const drain = () => {
            if (!taskQueue.length || active >= MAX_PARALLEL_CHUNK_REQUESTS) {
              return;
            }

            const nextTask = taskQueue.shift();
            if (!nextTask) {
              return;
            }

            active += 1;
            const release = () => {
              active = Math.max(active - 1, 0);
              drain();
            };
            nextTask.element.addEventListener('load', release, { once: true });
            nextTask.element.addEventListener('error', release, { once: true });
            originalHeadAppendChild.call(nextTask.context, nextTask.element);
          };

          window.HTMLElement.prototype.appendChild = function patchedAppendChild(child) {
            try {
              if (
                child?.tagName === 'SCRIPT' &&
                typeof child.src === 'string' &&
                chunkPattern.test(new URL(child.src, window.location.origin).pathname)
              ) {
                enqueue(child, this);
                return child;
              }
            } catch (error) {
              console.warn('[chunk-throttler]', error);
            }
            return originalHeadAppendChild.call(this, child);
          };
        })();`}</Script>

        {isDevEnv && (
          <script
            crossOrigin="anonymous"
            src="//unpkg.com/react-scan/dist/auto.global.js"
          />
        )}
      </head>
      <body className="bg-background/20">
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
