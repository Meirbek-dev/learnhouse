'use client';

import { useResendVerification, useVerifyEmail } from '@/features/auth/hooks/useEmailVerification';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';

type VerifyState = 'idle' | 'verifying' | 'success' | 'error' | 'resent';

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useSession();
  const token = searchParams.get('token');
  const verifyEmailMutation = useVerifyEmail();
  const resendVerificationMutation = useResendVerification();

  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    setState('verifying');
    setErrorMessage(null);

    verifyEmailMutation.mutate(token, {
      onSuccess: () => {
        if (cancelled) return;
        setState('success');
        globalThis.setTimeout(() => {
          router.push('/');
        }, 3000);
      },
      onError: (error) => {
        if (cancelled) return;
        setState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Network error. Please try again.');
      },
    });

    return () => {
      cancelled = true;
    };
  }, [router, token, verifyEmailMutation]);

  const handleResend = useCallback(async () => {
    resendVerificationMutation.mutate(undefined, {
      onSuccess: () => {
        setState('resent');
      },
      onError: (error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Network error. Please try again.');
      },
    });
  }, [resendVerificationMutation]);

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
