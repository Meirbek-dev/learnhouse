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
      const response = await fetch(`${getAPIUrl()}users/id/${session.user.id}`, {
        headers: {
          Authorization: `Bearer ${session.tokens.access_token}`,
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.locale) {
          return userData.locale as Locale;
        }
      }
    }
  } catch (error) {
    // Check if this is a React postpone error (PPR bailout)
    // These should bubble up naturally, not be caught
    if (error && typeof error === 'object' && '$$typeof' in error && String(error.$$typeof) === 'Symbol(react.postpone)') {
      throw error;
    }
    // Only log actual errors, not PPR postpones
    // Silently fall through to default
  }

  // Fallback to cookie or default
  return (await cookies()).get(COOKIE_NAME)?.value || defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(COOKIE_NAME, locale);
}
