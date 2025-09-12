'use client';
import type { GamificationProfile, XPAwardRequest } from '@/services/gamification/gamification';
import { awardXP, getGamificationProfile } from '@/services/gamification/gamification';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { triggerGamificationUpdate } from '@/hooks/useLevelIndicator';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import type React from 'react';

interface GamificationContextValue {
  profile: GamificationProfile | null;
  setProfile: (p: GamificationProfile | null) => void;
  optimisticAward: (orgId: number, amount: number, source: string, extras?: Partial<XPAwardRequest>) => Promise<void>;
  refresh: (orgId: number) => Promise<void>;
}

const GamificationProfileContext = createContext<GamificationContextValue | undefined>(undefined);

function computeProgressPercent(p: GamificationProfile): number {
  if (p.level_progress_percent !== null) return p.level_progress_percent; // server authoritative preferred
  if (p.xp_in_level !== null && p.xp_to_next_level !== null && p.xp_to_next_level > 0) {
    return Math.max(0, Math.min(100, (p.xp_in_level / (p.xp_in_level + p.xp_to_next_level)) * 100));
  }
  return 0;
}

export const GamificationProfileProvider: React.FC<{ children: React.ReactNode; orgId: number }> = ({
  children,
  orgId,
}) => {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const inflight = useRef<Promise<any> | null>(null);

  const refresh = useCallback(
    async (oid: number = orgId) => {
      if (!(session?.tokens?.access_token && oid)) return;
      inflight.current = getGamificationProfile(oid, session.tokens.access_token).then((p) => {
        setProfile(p);
        return p;
      });
      await inflight.current;
    },
    [session?.tokens?.access_token, orgId],
  );

  const optimisticAward = useCallback(
    async (oid: number, amount: number, source: string, extras: Partial<XPAwardRequest> = {}) => {
      if (!(session?.tokens?.access_token && oid)) return;
      setProfile((prev) => {
        if (!prev) return prev;
        const clone: any = { ...prev };
        clone.total_xp += amount;
        clone.daily = clone.daily ? { ...clone.daily, xp_earned: clone.daily.xp_earned + amount } : undefined;
        if (clone.xp_in_level !== null && clone.xp_to_next_level !== null) {
          if (amount >= clone.xp_to_next_level) {
            // simple level up rollover; precise server calc will correct
            const spill = amount - clone.xp_to_next_level;
            clone.current_level += 1;
            clone.xp_in_level = spill;
            // rough next requirement guess keeps bar moving
            clone.xp_to_next_level = Math.round(clone.xp_to_next_level * 1.15);
            toast.success(`Level ${clone.current_level}!`, { duration: 3000 });
          } else {
            clone.xp_in_level += amount;
            clone.xp_to_next_level -= amount;
          }
        }
        clone.level_progress_percent = computeProgressPercent(clone);
        return clone;
      });
      try {
        await awardXP(oid, session.tokens.access_token, { source, custom_amount: amount, ...extras });
      } finally {
        await refresh(oid);
        triggerGamificationUpdate();
        toast(`+${amount} XP`, { icon: '⚡' });
      }
    },
    [session?.tokens?.access_token, refresh],
  );

  return (
    <GamificationProfileContext.Provider value={{ profile, setProfile, optimisticAward, refresh }}>
      {children}
    </GamificationProfileContext.Provider>
  );
};

export function useGamificationProfileContext(): GamificationContextValue {
  const ctx = useContext(GamificationProfileContext);
  if (!ctx) throw new Error('useGamificationProfileContext must be used within GamificationProfileProvider');
  return ctx;
}
