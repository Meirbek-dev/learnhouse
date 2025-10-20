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
        {isDevEnv && (
          <script
            crossOrigin="anonymous"
            src="//unpkg.com/react-scan/dist/auto.global.js"
          />
        )}
        {/*
          Disable automatic client prefetch links injected by Next.js.
          Many <link rel="prefetch"> tags can cause a storm of background
          chunk requests across many clients and lead to upstream 429s.
          This small, early-executing script removes existing prefetch tags
          and observes the DOM to remove any that appear later.
        */}
        <Script id="disable-prefetch-links" strategy="beforeInteractive">
          {`(function(){
            try {
              function removePrefetchLinks(root){
                (root || document).querySelectorAll && document.querySelectorAll('link[rel="prefetch"]').forEach(function(n){n.remove();});
              }
              removePrefetchLinks(document);
              // Observe for dynamically added prefetch links and remove them
              var mo = new MutationObserver(function(mutations){
                mutations.forEach(function(m){
                  m.addedNodes && m.addedNodes.forEach(function(node){
                    try{
                      if(node && node.nodeType === 1 && node.tagName === 'LINK' && node.getAttribute('rel') === 'prefetch'){
                        node.remove();
                      }
                    }catch(e){}
                  });
                });
              });
              mo.observe(document.documentElement || document, { childList: true, subtree: true });
            } catch (e) {
              // fail silently
            }
          })();`}
        </Script>
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
