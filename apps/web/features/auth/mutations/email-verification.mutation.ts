'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationOptions } from '@tanstack/react-query';

async function verifyEmailRequest(token: string) {
  const response = await apiFetch('auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Verification failed. The link may have expired.');
  }

  return response.json().catch(() => null);
}

async function resendVerificationRequest() {
  const response = await apiFetch('auth/resend-verification', {
    method: 'POST',
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Failed to resend verification email.');
  }

  return response.json().catch(() => null);
}

export function verifyEmailMutationOptions() {
  return mutationOptions({
    mutationFn: verifyEmailRequest,
  });
}

export function resendVerificationMutationOptions() {
  return mutationOptions({
    mutationFn: resendVerificationRequest,
  });
}
