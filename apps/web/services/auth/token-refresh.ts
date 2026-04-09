'use client';

import { getAPIUrl } from '@services/config/config';

let refreshInFlight: Promise<boolean> | null = null;

/** Deduplicates concurrent refresh requests — only one fetch in flight at a time. */
export async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch(`${getAPIUrl()}auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}
