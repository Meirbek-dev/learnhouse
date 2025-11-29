/*
  getUserLocale

  Lightweight helper that returns the user's locale preference.
  IMPORTANT: this implementation intentionally avoids calling
  `cookies()` or other dynamic server APIs directly so it can be
  executed during static generation. Instead, callers should pass a
  cookie store (for example the `cookies` object received in
  `getRequestConfig`) when available.

  Behavior:
  - If `cookieStore` is provided and has a `get` method, read
    `NEXT_LOCALE` from it and return that value when present.
  - Otherwise return `defaultLocale`.

  This change prevents accidental dynamic server usage during
  static page generation.
*/

import { defaultLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

const COOKIE_NAME = 'NEXT_LOCALE';

export async function getUserLocale(cookieStore?: { get: (name: string) => { value?: string } | undefined }) {
  try {
    if (cookieStore && typeof cookieStore.get === 'function') {
      const c = cookieStore.get(COOKIE_NAME);
      if (c && c.value) return c.value as Locale;
    }
  } catch (error) {
    // Don't throw — callers should fall back to default locale
    // Logging omitted to avoid noisy output during static builds
  }

  return defaultLocale;
}

export async function setUserLocale() {
  // Intentionally a no-op here. To set cookies you need access to
  // the request/response cookie store; implement per-route when
  // required.
  throw new Error('setUserLocale requires a cookie store and should be implemented in-route');
}
