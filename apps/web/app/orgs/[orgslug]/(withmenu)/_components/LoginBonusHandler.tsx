'use client';

import { useGamificationContext } from '@/components/Contexts/GamificationContext';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

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

  const timeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!orgId || !profile) return;

    isMountedRef.current = true;

    try {
      const todayKey = `gamification:lastLoginAward:${orgId}:${new Date().toISOString().slice(0, 10)}`;
      const alreadyDone = typeof window !== 'undefined' ? localStorage.getItem(todayKey) : null;

      if (alreadyDone) return;

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
            timeoutRef.current = window.setTimeout(() => {
              if (isMountedRef.current) setShowBadge(false);
            }, 5000) as unknown as number;
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
    <div className="animate-in fade-in slide-in-from-bottom-5 pointer-events-none fixed right-4 bottom-20 z-50 duration-300">
      <div className="flex items-center gap-2 rounded-full bg-linear-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
        <span className="text-lg">✨</span>
        <span>{t('loginBonus.dailyBonus', { xp: 10 })}</span>
      </div>
    </div>
  );
}
