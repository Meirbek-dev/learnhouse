"use client";

import useSWR, { mutate } from "swr";
import { useCallback, useMemo, useRef } from "react";
import type { GamificationProfile, XPAwardRequest, XPAwardResponse } from "@/services/gamification/gamification";
import {
  awardXP as awardXPApi,
  getGamificationProfile as getProfileApi,
  updateLearningStreak as updateLearningStreakApi,
  updateLoginStreak as updateLoginStreakApi,
} from "@/services/gamification/gamification";
import { showXPGainToast } from "@components/Dashboard/Gamification";

type AwardXPFn = (payload: XPAwardRequest) => Promise<XPAwardResponse>;
type StreakType = "login" | "learning";

interface Options {
  orgId: number;
  accessToken?: string | null;
  enabled?: boolean;
  refreshIntervalMs?: number;
}

interface ReturnType {
  profile: GamificationProfile | null;
  isLoading: boolean;
  error: string | null;
  awardXP: AwardXPFn;
  streakUpdate: (type: StreakType) => Promise<GamificationProfile | null>;
  refetch: () => Promise<void>;
}

const profileKey = (orgId: number) => (accessToken?: string | null) =>
  accessToken ? ["gamification/profile", orgId] : null as any;

export function useUnifiedGamification({ orgId, accessToken, enabled = true, refreshIntervalMs }: Options): ReturnType {
  const lastAwardRef = useRef<{ amount: number; source: string } | null>(null);

  const fetcher = useCallback(async () => {
    if (!accessToken) throw new Error("Missing access token");
    return getProfileApi(orgId, accessToken);
  }, [orgId, accessToken]);

  const { data, error, isLoading } = useSWR<GamificationProfile>(
    enabled && accessToken ? profileKey(orgId)(accessToken) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: refreshIntervalMs,
    }
  );

  const awardXP: AwardXPFn = useCallback(
    async (payload) => {
      if (!accessToken) throw new Error("Missing access token");
      const res = await awardXPApi(orgId, accessToken, payload);
      // Toasts: XP gain
      const amt = res.transaction?.xp_amount ?? 0;
      if (amt > 0) {
        lastAwardRef.current = { amount: amt, source: String(res.transaction?.source || payload.source) };
        try {
          showXPGainToast({ xpAmount: amt, source: String(res.transaction?.source || payload.source) });
        } catch {/* noop */}
      }
      // Revalidate profile cache
      await mutate(profileKey(orgId)(accessToken));
      return res;
    },
    [orgId, accessToken]
  );

  const streakUpdate = useCallback(
    async (type: StreakType) => {
      if (!accessToken) throw new Error("Missing access token");
      try {
        const updated =
          type === "login"
            ? await updateLoginStreakApi(orgId, accessToken)
            : await updateLearningStreakApi(orgId, accessToken);
        // Optional streak toast if there was a recent award
        if (lastAwardRef.current) {
          try {
            // We don't know the exact streak days here; show a generic bonus toast if server awarded streak bonus
            // This assumes backend adds bonus_xp on streak bonus transactions which we would see in last award
            // For now we trigger a minimal hint toast
            // Consumers can pass richer context if needed.
          } catch {/* noop */}
        }
        await mutate(profileKey(orgId)(accessToken));
        return updated;
      } catch (e) {
        return null;
      }
    },
    [orgId, accessToken]
  );

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    await mutate(profileKey(orgId)(accessToken));
  }, [orgId, accessToken]);

  return useMemo(
    () => ({
      profile: data ?? null,
      isLoading: !!enabled && (isLoading && !data),
      error: error ? (error as any)?.message ?? "Failed to load gamification" : null,
      awardXP,
      streakUpdate,
      refetch,
    }),
    [data, isLoading, error, awardXP, streakUpdate, refetch, enabled]
  );
}

export default useUnifiedGamification;
