'use client';

import { useGamificationStore } from '@/stores/gamification';
import React, { lazy, useEffect } from 'react';
import { useXPToast } from '@/lib/gamification/components/xp-toast';
import { AnimatePresence } from 'motion/react';
import type { UserGamificationProfile } from '@/types/gamification';

const LevelUpCelebration = lazy(() =>
  import('@/components/Dashboard/Gamification/xp-toast').then((mod) => ({ default: mod.LevelUpCelebration })),
);

// ── Provider ──────────────────────────────────────────────────────────────────
// Responsibilities:
//   1. Hydrate the store from server-provided initial data.
//   2. Trigger fetchIfNeeded when no initial data is available.
//   3. Drain pendingXPToasts into the hook-based toast system (requires React lifecycle).
//   4. Render ToastContainer + LevelUpCelebration (require React hooks).

interface GamificationProviderProps {
  children: React.ReactNode;
  initialData?: {
    profile?: UserGamificationProfile | null;
    dashboard?: any;
    leaderboard?: any;
  };
}

export function GamificationProvider({ children, initialData }: GamificationProviderProps) {
  const { ToastContainer, showXPToast: showEnhancedXPToast } = useXPToast();

  const hydrate = useGamificationStore((s) => s._hydrate);
  const fetchIfNeeded = useGamificationStore((s) => s.fetchIfNeeded);
  const pendingXPToasts = useGamificationStore((s) => s.pendingXPToasts);
  const consumeXPToasts = useGamificationStore((s) => s.consumeXPToasts);
  const levelUpQueue = useGamificationStore((s) => s.levelUpQueue);
  const dismissLevelUpCelebration = useGamificationStore((s) => s.dismissLevelUpCelebration);
  const profile = useGamificationStore((s) => s.profile);

  useEffect(() => {
    if (initialData) {
      hydrate({
        profile: initialData.dashboard?.profile ?? initialData.profile,
        dashboard: initialData.dashboard ?? null,
        leaderboard: initialData.dashboard?.leaderboard ?? initialData.leaderboard ?? null,
      });
    }
  }, [initialData, hydrate]);

  useEffect(() => {
    if (initialData === undefined) {
      void fetchIfNeeded();
    }
  }, [initialData, fetchIfNeeded]);

  useEffect(() => {
    if (pendingXPToasts.length === 0) return;
    const toasts = consumeXPToasts();
    for (const toast of toasts) {
      showEnhancedXPToast({ amount: toast.amount, source: toast.source });
    }
  }, [pendingXPToasts, consumeXPToasts, showEnhancedXPToast]);

  return (
    <>
      {children}
      <ToastContainer />
      <AnimatePresence initial={false}>
        {levelUpQueue[0] && (
          <React.Suspense fallback={null}>
            <LevelUpCelebration
              key={`level-up-${levelUpQueue[0].newLevel}`}
              newLevel={levelUpQueue[0].newLevel}
              onDismiss={dismissLevelUpCelebration}
              compact={(profile?.preferences as any)?.display?.compactMode ?? false}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
    </>
  );
}
