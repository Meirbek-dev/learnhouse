'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/hooks/useSession';

type VerifyState = 'idle' | 'verifying' | 'success' | 'error' | 'resent';

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useSession();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verify() {
      try {
        const response = await apiFetch('auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        if (response.ok) {
          setState('success');
          globalThis.setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          const data = await response.json().catch(() => null) as { detail?: string } | null;
          setState('error');
          setErrorMessage(
            typeof data?.detail === 'string'
              ? data.detail
              : 'Verification failed. The link may have expired.'
          );
        }
      } catch {
        if (!cancelled) {
          setState('error');
          setErrorMessage('Network error. Please try again.');
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleResend = useCallback(async () => {
    try {
      const response = await apiFetch('auth/resend-verification', {
        method: 'POST',
      });
      if (response.ok) {
        setState('resent');
      } else {
        setErrorMessage('Failed to resend verification email.');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">Email Verification</h1>

        {state === 'verifying' && (
          <p className="text-muted-foreground">Verifying your email address...</p>
        )}

        {state === 'success' && (
          <div className="space-y-2">
            <p className="text-green-600 font-medium">Email verified successfully!</p>
            <p className="text-muted-foreground text-sm">Redirecting you to the home page...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <p className="text-red-600">{errorMessage}</p>
            {isAuthenticated && (
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => void handleResend()}
                type="button"
              >
                Resend verification email
              </button>
            )}
          </div>
        )}

        {state === 'idle' && !token && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Please verify your email address to access all features.
            </p>
            {isAuthenticated && user && (
              <>
                <p className="text-sm text-muted-foreground">
                  A verification email was sent to <strong>{user.email}</strong>.
                </p>
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={() => void handleResend()}
                  type="button"
                >
                  Resend verification email
                </button>
              </>
            )}
          </div>
        )}

        {state === 'resent' && (
          <p className="text-green-600 font-medium">
            Verification email sent! Please check your inbox.
          </p>
        )}
      </div>
    </div>
  );
}
