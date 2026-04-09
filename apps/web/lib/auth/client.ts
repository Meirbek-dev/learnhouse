'use client';

import { getAPIUrl } from '@services/config/config';
import { generateUUID } from '../utils';

export type AuthInvalidationReason =
  | 'expired'
  | 'logged_out'
  | 'revoked'
  | 'network_recovery_failed'
  | 'unauthenticated';

export interface AuthInvalidationDetail {
  reason: AuthInvalidationReason;
  redirectTo?: string | null;
  returnTo?: string | null;
  nonce?: string;
}

export type AuthInvalidationMessage = AuthInvalidationDetail & {
  nonce: string;
  sentAt: number;
};

const AUTH_INVALIDATED_EVENT = 'auth:session-invalidated';
const AUTH_BROADCAST_CHANNEL = 'auth-session';
const AUTH_ROUTE_PREFIXES = ['/login', '/signup', '/forgot', '/reset'] as const;
const PROTECTED_ROUTE_PREFIXES = [
  '/dash',
  '/courses',
  '/profile',
  '/settings',
  '/admin',
  '/analytics',
  '/editor',
  '/certificates',
] as const;

// Module-level singleton — one channel for the entire page lifetime.
// BroadcastChannel is supported in all modern browsers (Chrome 54+, Firefox 38+, Safari 15.4+).
let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof globalThis.window === 'undefined' || !('BroadcastChannel' in globalThis)) return null;
  if (!_channel) {
    _channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  }
  return _channel;
}

function createMessage(detail: AuthInvalidationDetail): AuthInvalidationMessage {
  return {
    ...detail,
    nonce: detail.nonce ?? generateUUID(),
    sentAt: Date.now(),
  };
}

/**
 * Broadcasts an auth invalidation event to other tabs via BroadcastChannel,
 * and optionally dispatches a local window event for the current tab.
 *
 * Pass `local: true` when the calling code has NOT already handled the
 * invalidation locally (e.g. API interceptors, auth service). The
 * AuthBroadcastListener handles its own local state directly, so it passes
 * `local: false` (the default).
 */
export function emitAuthInvalidation(
  detail: AuthInvalidationDetail,
  options: { local?: boolean } = {},
): AuthInvalidationMessage {
  const message = createMessage(detail);

  getChannel()?.postMessage(message);

  if (options.local && typeof globalThis.window !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent<AuthInvalidationMessage>(AUTH_INVALIDATED_EVENT, { detail: message }));
  }

  return message;
}

/**
 * Subscribes to auth invalidation events from all tabs (including this one
 * when `local: true` was used). Returns an unsubscribe function for useEffect
 * cleanup.
 */
export function subscribeToAuthInvalidation(listener: (detail: AuthInvalidationMessage) => void): () => void {
  if (typeof globalThis.window === 'undefined') return () => {};

  const handleLocal = (e: Event) => {
    const {detail} = (e as CustomEvent<AuthInvalidationMessage>);
    if (detail) listener(detail);
  };
  globalThis.addEventListener(AUTH_INVALIDATED_EVENT, handleLocal);

  const channel = getChannel();
  const handleChannel = (e: MessageEvent<AuthInvalidationMessage>) => {
    if (e.data) listener(e.data);
  };
  channel?.addEventListener('message', handleChannel);

  return () => {
    globalThis.removeEventListener(AUTH_INVALIDATED_EVENT, handleLocal);
    // Do not close the singleton channel — other subscribers still need it.
    channel?.removeEventListener('message', handleChannel);
  };
}

export function buildLoginRedirect(returnTo?: string | null): string {
  const resolvedReturnTo = normalizeReturnTo(returnTo ?? getCurrentReturnTo());
  return `/login?returnTo=${encodeURIComponent(resolvedReturnTo)}`;
}

export function getCurrentReturnTo(): string {
  if (typeof globalThis.window === 'undefined') return '/';
  const { pathname, search } = globalThis.location;
  return `${pathname}${search}` || '/';
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function normalizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return '/';

  try {
    const origin = typeof globalThis.window === 'undefined' ? 'http://localhost' : globalThis.location.origin;
    const parsed = new URL(returnTo, origin);
    const normalizedPath = `${parsed.pathname}${parsed.search}` || '/';

    if (parsed.origin !== origin || isAuthRoute(parsed.pathname)) {
      return '/';
    }

    return normalizedPath;
  } catch {
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
      return '/';
    }

    const [pathname] = returnTo.split('?');
    return isAuthRoute(pathname || '/') ? '/' : returnTo;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Deduplicates concurrent refresh requests — only one fetch in flight at a time. */
export async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${getAPIUrl()}auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
