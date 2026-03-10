'use client';

import { useGamificationContext } from '@/components/Contexts/GamificationContext';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * LoginBonusHandler (Simplified & Subtle)
 *
 * Awards daily login bonus SILENTLY with subtle visual feedback.
 * Uses localStorage to ensure once-per-day execution per org.
 * Shows small badge for 5 seconds instead of intrusive toast.
 *
 * Backend is idempotent and enforces daily caps; client guard prevents extra calls.
 */

interface LoginBonusHandlerProps {
  orgId: number;
}

export function LoginBonusHandler({ orgId }: LoginBonusHandlerProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const { profile, updateStreak, awardXP } = useGamificationContext();
  const [showBadge, setShowBadge] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(false);
  // Synchronous guard: prevents concurrent runs when the effect re-fires before
  // localStorage.setItem completes (unstable function refs in deps cause this).
  const hasAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!orgId || !profile) return;
    if (hasAttemptedRef.current) return;

    isMountedRef.current = true;

    try {
      const todayKey = `gamification:lastLoginAward:${orgId}:${new Date().toISOString().slice(0, 10)}`;
      const alreadyDone = typeof globalThis.window !== 'undefined' ? localStorage.getItem(todayKey) : null;

      if (alreadyDone) return;

      // Mark as attempted synchronously before the async IIFE so re-runs from
      // dep changes cannot start a second concurrent request.
      hasAttemptedRef.current = true;

      // Fire-and-forget: update login streak SILENTLY
      (async () => {
        try {
          // Update login streak using Server Action
          await updateStreak('login');

          // Award login bonus with idempotency key per user/day/org
          await awardXP(
            {
              source: 'login_bonus',
              idempotency_key: `login_bonus_${profile.user_id}_${orgId}_${new Date().toISOString().slice(0, 10)}`,
            },
            { silent: true }, // Silent mode - no toast
          );

          localStorage.setItem(todayKey, '1');

          // Show subtle badge indicator for 5 seconds (if still mounted)
          if (isMountedRef.current) {
            setShowBadge(true);
            timeoutRef.current = globalThis.setTimeout(() => {
              if (isMountedRef.current) setShowBadge(false);
            }, 5000);
          }
        } catch (error) {
          // Non-fatal error, log and continue
          console.warn('Failed to award login bonus:', error);
        }
      })();
    } catch (error) {
      // Ignore storage errors (e.g., SSR, private browsing)
      console.warn('localStorage not available:', error);
    }

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [orgId, profile, updateStreak, awardXP]);

  // Show subtle floating badge on first daily login
  if (!showBadge) return null;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-5 pointer-events-none fixed right-4 bottom-20 z-50 duration-300"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-gradient-to-r from-emerald-500/95 to-green-600/95 px-4 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl">
          <span aria-hidden>✨</span>
        </div>

        <div className="min-w-0">
          <div className="truncate">{t('loginBonus.dailyBonus', { xp: 10 })}</div>
        </div>
      </div>
    </div>
  );
}
