'use server';

import { getAPIUrl } from '@services/config/config';
import { defaultLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import { cookies } from 'next/headers';
import { auth } from '@/auth';

// Here the locale is read from a cookie or user profile in database
const COOKIE_NAME = 'NEXT_LOCALE';

export async function getUserLocale() {
  // Try to get locale from user profile first
  try {
    const session = await auth();
    if (session?.user?.id && session?.tokens?.access_token) {
      const apiUrl = getAPIUrl();

      // Validate API URL before making request
      if (!apiUrl || apiUrl === 'undefined' || apiUrl === 'null') {
        console.warn('[getUserLocale] API URL not configured, falling back to cookie');
        return (await cookies()).get(COOKIE_NAME)?.value || defaultLocale;
      }

      try {
        const response = await fetch(`${apiUrl}users/id/${session.user.id}`, {
          headers: {
            Authorization: `Bearer ${session.tokens.access_token}`,
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          const userData = await response.json();
          if (userData.locale) {
            return userData.locale as Locale;
          }
        }
      } catch (error: any) {
        // Log fetch errors but don't fail the entire request
        console.warn('[getUserLocale] Failed to fetch user locale:', {
          error: error.message,
          code: error.code,
        });
      }
    }
  } catch (error) {
    // Check if this is a React postpone error (PPR bailout)
    // These should bubble up naturally, not be caught
    if (
      error &&
      typeof error === 'object' &&
      '$$typeof' in error &&
      String(error.$$typeof) === 'Symbol(react.postpone)'
    ) {
      throw error;
    }
    // Log unexpected errors in production for debugging
    if (process.env.NODE_ENV === 'production') {
      console.error('[getUserLocale] Unexpected error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    // Silently fall through to default
  }

  // Fallback to cookie or default
  try {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value || defaultLocale;
  } catch (error) {
    console.error('[getUserLocale] Cookie access failed:', error);
    return defaultLocale;
  }
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(COOKIE_NAME, locale);
}
