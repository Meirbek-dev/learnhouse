'use client';

import { getAPIUrl } from '@services/config/config';

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

const AUTH_INVALIDATED_EVENT = 'auth:session-invalidated';
const AUTH_BROADCAST_CHANNEL = 'auth-session';
const AUTH_STORAGE_KEY = 'auth:session-invalidated';

type AuthInvalidationMessage = AuthInvalidationDetail & {
  nonce: string;
  sentAt: number;
};

let refreshInFlight: Promise<boolean> | null = null;

function getNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createMessage(detail: AuthInvalidationDetail): AuthInvalidationMessage {
  return {
    ...detail,
    nonce: detail.nonce ?? getNonce(),
    sentAt: Date.now(),
  };
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof globalThis.window === 'undefined' || typeof globalThis.BroadcastChannel === 'undefined') {
    return null;
  }

  return new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
}

function dispatchLocalInvalidation(message: AuthInvalidationMessage): void {
  if (typeof globalThis.window === 'undefined') {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<AuthInvalidationMessage>(AUTH_INVALIDATED_EVENT, {
      detail: message,
    }),
  );
}

export function buildLoginRedirect(returnTo?: string | null): string {
  const resolvedReturnTo = returnTo ?? getCurrentReturnTo();
  return `/login?returnTo=${encodeURIComponent(resolvedReturnTo)}`;
}

export function getCurrentReturnTo(): string {
  if (typeof globalThis.window === 'undefined') {
    return '/';
  }

  const { pathname, search } = globalThis.window.location;
  return `${pathname}${search}` || '/';
}

export function broadcastAuthInvalidation(detail: AuthInvalidationDetail): AuthInvalidationMessage {
  const message = createMessage(detail);

  const channel = getBroadcastChannel();
  if (channel) {
    channel.postMessage(message);
    channel.close();
  }

  try {
    globalThis.localStorage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(message));
    globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage failures; BroadcastChannel/local dispatch already cover most browsers.
  }

  return message;
}

export function notifyAuthInvalidation(detail: AuthInvalidationDetail): AuthInvalidationMessage {
  const message = broadcastAuthInvalidation(detail);
  dispatchLocalInvalidation(message);
  return message;
}

export async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

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

export function subscribeToAuthInvalidation(
  listener: (detail: AuthInvalidationMessage) => void,
): () => void {
  if (typeof globalThis.window === 'undefined') {
    return () => {};
  }

  const handleLocalEvent = (event: Event) => {
    const detail = (event as CustomEvent<AuthInvalidationMessage>).detail;
    if (detail) {
      listener(detail);
    }
  };

  globalThis.window.addEventListener(AUTH_INVALIDATED_EVENT, handleLocalEvent);

  const channel = getBroadcastChannel();
  const handleChannelMessage = (event: MessageEvent<AuthInvalidationMessage>) => {
    if (event.data) {
      listener(event.data);
    }
  };
  channel?.addEventListener('message', handleChannelMessage);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      listener(JSON.parse(event.newValue) as AuthInvalidationMessage);
    } catch {
      // Ignore malformed storage events.
    }
  };

  globalThis.window.addEventListener('storage', handleStorage);

  return () => {
    globalThis.window.removeEventListener(AUTH_INVALIDATED_EVENT, handleLocalEvent);
    globalThis.window.removeEventListener('storage', handleStorage);
    channel?.removeEventListener('message', handleChannelMessage);
    channel?.close();
  };
}
