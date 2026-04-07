'use client';

import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

export function AuthErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex w-full items-center gap-2 rounded-md bg-red-200 p-3 text-red-950">
      <AlertTriangle size={18} />
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
}

export function AuthSuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex w-full items-center gap-2 rounded-md bg-green-200 p-3 text-green-950">
      <Info size={18} />
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit button
// ---------------------------------------------------------------------------

interface AuthSubmitButtonProps {
  isPending: boolean;
  label: string;
  pendingLabel: string;
  className?: string;
}

export function AuthSubmitButton({ isPending, label, pendingLabel, className }: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      className={className ?? 'w-full'}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2
            className="mr-2 h-4 w-4 animate-spin"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// useAuthAction hook
// ---------------------------------------------------------------------------

/**
 * Wraps an async form submission handler with transition, error, and success
 * state. Keeps form pages free of boilerplate.
 *
 * Usage:
 *   const { execute, error, message, isPending } = useAuthAction(async (data) => {
 *     const res = await someApiCall(data);
 *     if (!res.ok) throw new Error(t('someError'));
 *     setMessage(t('success'));
 *   });
 */
export function useAuthAction<T>(fn: (data: T) => Promise<void>) {
  const t = useTranslations('Validation');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const execute = (data: T) => {
    setError('');
    setMessage('');
    startTransition(async () => {
      try {
        await fn(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('unknownError'));
      }
    });
  };

  return { execute, error, message, setMessage, isPending };
}
