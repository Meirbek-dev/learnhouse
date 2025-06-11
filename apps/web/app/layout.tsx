import ClientLayout from './client-layout'
import { isDevEnv } from './auth/options'
import Script from 'next/script'
import '../styles/globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, setRequestLocale } from 'next-intl/server'
import { DM_Sans } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-dm-sans',
  display: 'swap',
  preload: true,
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
})

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html className={`${dmSans.className}`} lang={locale}>
      <head>
        <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
      </head>
      <body className="antialiased">
        {isDevEnv ? (
          ''
        ) : (
          <Script
            data-website-id="a1af6d7a-9286-4a1f-8385-ddad2a29fcbb"
            src="/umami/script.js"
          />
        )}

        <NextIntlClientProvider messages={messages}>
          <ClientLayout>{children}</ClientLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
