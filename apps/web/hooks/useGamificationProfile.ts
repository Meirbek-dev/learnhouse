'use client';

import { getGamificationProfile, getXPSourcesMetadata } from '@/services/gamification/gamification';
import type { GamificationProfile } from '@/services/gamification/gamification';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

interface UseGamificationProfileOptions {
  orgId: number;
  enabled?: boolean;
  preloadXPSources?: boolean; // prefetch XP sources metadata
  refreshIntervalMs?: number; // auto refresh interval (disabled if undefined)
}

interface UseGamificationProfileReturn {
  profile: GamificationProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  xpSources: Record<string, { label: string; default_xp: number; category: string; description: string }>;
}

// Global XP source metadata cache (shared across hook instances)
const xpSourceCache: {
  loaded: boolean;
  map: Record<string, { label: string; default_xp: number; category: string; description: string }>;
  loadingPromise?: Promise<void>;
} = { loaded: false, map: {} };

async function ensureXPSourcesPrefetched() {
  if (xpSourceCache.loaded) return;
  if (xpSourceCache.loadingPromise) return xpSourceCache.loadingPromise;
  xpSourceCache.loadingPromise = getXPSourcesMetadata()
    .then((sources) => {
      for (const s of sources) {
        xpSourceCache.map[s.key] = {
          label: s.label,
          default_xp: s.default_xp,
          category: s.category,
          description: s.description,
        };
      }
      xpSourceCache.loaded = true;
    })
    .catch(() => {
      // swallow; remains not loaded
    })
    .finally(() => {
      xpSourceCache.loadingPromise = undefined;
    });
  return xpSourceCache.loadingPromise;
}

export function useGamificationProfile(options: UseGamificationProfileOptions): UseGamificationProfileReturn {
  const { orgId, enabled = true, preloadXPSources = true, refreshIntervalMs } = options;
  const { data: session } = useSession();
  const accessToken: string | undefined = (session as any)?.tokens?.access_token;
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!enabled) return;
    if (!(orgId && accessToken)) return;
    setIsLoading(true);
    try {
      const p = await getGamificationProfile(orgId, accessToken);
      setProfile(p);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, orgId, accessToken]);

  // Initial load
  useEffect(() => {
    if (!enabled) return;
    fetchProfile();
  }, [fetchProfile, enabled]);

  // Optional XP source metadata prefetch
  useEffect(() => {
    if (!(preloadXPSources && enabled)) return;
    ensureXPSourcesPrefetched();
  }, [preloadXPSources, enabled]);

  // Auto refresh
  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs <= 0) return;
    if (!enabled) return;
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => {
      fetchProfile();
    }, refreshIntervalMs);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [refreshIntervalMs, fetchProfile, enabled]);

  return { profile, isLoading, error, refetch: fetchProfile, xpSources: xpSourceCache.map };
}
