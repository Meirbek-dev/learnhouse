'use client';

import { useGamificationContext } from '@/components/Contexts/GamificationContext';
import { useEffect, useState } from 'react';

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
  const { profile, updateStreak, awardXP } = useGamificationContext();
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    if (!orgId || !profile) return;

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

          // Show subtle badge indicator for 5 seconds
          setShowBadge(true);
          setTimeout(() => setShowBadge(false), 5000);
        } catch (error) {
          // Non-fatal error, log and continue
          console.warn('Failed to award login bonus:', error);
        }
      })();
    } catch (error) {
      // Ignore storage errors (e.g., SSR, private browsing)
      console.warn('localStorage not available:', error);
    }
  }, [orgId, profile, updateStreak, awardXP]);

  // Show subtle floating badge on first daily login
  if (!showBadge) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
        <span className="text-lg">✨</span>
        <span>+10 XP Daily Bonus</span>
      </div>
    </div>
  );
}
