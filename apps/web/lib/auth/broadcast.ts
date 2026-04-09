'use client';

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

export type AuthInvalidationMessage = Omit<AuthInvalidationDetail, 'nonce'> & {
  nonce: string;
  sentAt: number;
};

const CHANNEL_NAME = 'auth-session';
const LOCAL_EVENT = 'auth:session-invalidated';

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!_channel) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return _channel;
}

/**
 * Broadcasts an auth invalidation event to other tabs via BroadcastChannel,
 * and optionally dispatches a local window event for the current tab.
 *
 * Pass `local: true` when the calling code has NOT already handled the
 * invalidation locally (e.g. API interceptors, auth service). The
 * AuthProvider handles its own local state directly.
 */
export function emitAuthInvalidation(
  detail: AuthInvalidationDetail,
  options: { local?: boolean } = {},
): AuthInvalidationMessage {
  const msg: AuthInvalidationMessage = {
    ...detail,
    nonce: detail.nonce ?? generateUUID(),
    sentAt: Date.now(),
  };

  getChannel()?.postMessage(msg);

  if (options.local && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AuthInvalidationMessage>(LOCAL_EVENT, { detail: msg }));
  }

  return msg;
}

/**
 * Subscribes to auth invalidation events from all tabs (including this one
 * when `local: true` was used). Returns an unsubscribe function for cleanup.
 */
export function subscribeToAuthInvalidation(
  listener: (msg: AuthInvalidationMessage) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent<AuthInvalidationMessage>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(LOCAL_EVENT, onLocal);

  const channel = getChannel();
  const onChannel = (e: MessageEvent<AuthInvalidationMessage>) => {
    if (e.data) listener(e.data);
  };
  channel?.addEventListener('message', onChannel);

  return () => {
    window.removeEventListener(LOCAL_EVENT, onLocal);
    // Do not close the singleton channel — other subscribers still need it.
    channel?.removeEventListener('message', onChannel);
  };
}
