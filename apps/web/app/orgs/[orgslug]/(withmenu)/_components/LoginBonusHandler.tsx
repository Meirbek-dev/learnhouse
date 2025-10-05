'use client';

import { useEffect } from 'react';
import { useGamificationContext } from '@/components/Contexts/GamificationContext';

/**
 * LoginBonusHandler
 *
 * Handles automatic daily login bonus and streak updates.
 * Uses localStorage to ensure once-per-day execution per org.
 *
 * Backend is idempotent and enforces daily caps; client guard prevents extra calls.
 */

interface LoginBonusHandlerProps {
  orgId: number;
}

export function LoginBonusHandler({ orgId }: LoginBonusHandlerProps) {
  const { profile, updateStreak, awardXP } = useGamificationContext();

  useEffect(() => {
    if (!orgId || !profile) return;

    try {
      const todayKey = `gamification:lastLoginAward:${orgId}:${new Date().toISOString().slice(0, 10)}`;
      const alreadyDone = typeof window !== 'undefined' ? localStorage.getItem(todayKey) : '1';

      if (alreadyDone) return;

      // Fire-and-forget: update login streak, then award login bonus
      (async () => {
        try {
          // Update login streak using Server Action
          await updateStreak('login');

          // Award login bonus with idempotency key per user/day/org
          await awardXP({
            source: 'login_bonus',
            idempotency_key: `login_bonus_${profile.user_id}_${orgId}_${new Date().toISOString().slice(0, 10)}`,
          });

          localStorage.setItem(todayKey, '1');
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

  // This component renders nothing
  return null;
}
