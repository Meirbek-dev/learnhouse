import { RequestBodyWithAuthHeader, errorHandling } from '@/services/utils/ts/requests';
import { getAPIUrl } from '@/services/config/config';

// ---------------------------------------------------------------------------
// NOTE: Backend gamification models were refactored (Python side) and some field
// names diverged from the legacy frontend expectations. We normalize all
// responses here so components can continue to rely on a stable shape without
// hunting for snake_case vs legacy aliases. This is the ONLY place that should
// know about backend naming differences.
// ---------------------------------------------------------------------------

// Modern gamification interfaces aligned with new server architecture
// New server contracts (public API)
export interface GamificationProfile {
  user_id: number;
  org_id: number;
  total_xp: number;
  current_level: number;
  xp_in_level: number;
  xp_to_next: number;
  progress: number; // 0-1
  updated_at: string; // ISO
  streaks?: { [k: string]: number } | { login: number; learning: number } | null;
}

export interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  xp_amount: number;
  source: string;
  source_id?: string | null;
  multiplier_applied?: number;
  bonus_xp?: number;
  reason?: string | null;
  transaction_metadata?: Record<string, any>;
  created_at: string;
  created_by_admin?: boolean;
  admin_user_id?: number | null;
  triggered_level_up?: boolean;
  previous_level?: number;
  new_level?: number;
  idempotency_key?: string | null;
}

export interface XPAwardRequest {
  source: string;
  source_id?: string;
  custom_amount?: number;
  idempotency_key?: string;
  metadata?: Record<string, any>;
}

export interface XPAwardResponse {
  transaction: XPTransaction;
  profile: GamificationProfile;
  level_up_occurred: boolean;
  previous_level: number;
  achievements_unlocked?: string[];
  is_new_transaction?: boolean; // new backend field
  used_default_xp?: boolean;
  used_custom_amount?: number | null;
}

export interface GamificationDashboard {
  profile: GamificationProfile;
  recent_tx: Array<{
    transaction_id: number;
    amount: number;
    source: string;
    source_id?: string | null;
    created_at: string;
    metadata?: Record<string, any> | null;
  }>;
  preferences?: Record<string, any> | null;
}

// --------------------------- Normalization Utilities -----------------------

function safeNumber(val: any, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProfile(input: any): GamificationProfile {
  const raw = input?.data?.profile ?? input?.profile ?? input;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid profile payload');
  return {
    user_id: safeNumber(raw.user_id),
    org_id: safeNumber(raw.org_id),
    total_xp: safeNumber(raw.total_xp),
    current_level: safeNumber(raw.current_level, 1),
    xp_in_level: safeNumber(raw.xp_in_level),
    xp_to_next: safeNumber(raw.xp_to_next),
    progress: Number(raw.progress) || 0,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : new Date(raw.updated_at).toISOString(),
    streaks: raw.streaks ?? null,
  };
}

function normalizeTransaction(raw: any): XPTransaction {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid transaction payload');
  const tx: XPTransaction = {
    id: raw.id ?? 0,
    user_id: raw.user_id ?? 0,
    org_id: raw.org_id ?? 0,
    xp_amount: safeNumber(raw.xp_amount ?? raw.xp_awarded),
    source: raw.source ?? raw.xp_source ?? 'unknown',
    source_id: raw.source_id ?? null,
    multiplier_applied: safeNumber(raw.multiplier_applied, 1),
    bonus_xp: safeNumber(raw.bonus_xp),
    reason: raw.reason ?? null,
    transaction_metadata: raw.transaction_metadata ?? raw.metadata ?? {},
    created_at: raw.created_at ?? new Date().toISOString(),
    created_by_admin: raw.created_by_admin ?? false,
    admin_user_id: raw.admin_user_id ?? null,
    triggered_level_up: !!(raw.triggered_level_up ?? raw.level_up_occurred),
    previous_level: raw.previous_level ?? raw.level_before,
    new_level: raw.new_level ?? raw.level_after,
    idempotency_key: raw.idempotency_key ?? null,
  };
  return tx;
}

function normalizeAwardResponse(input: any): XPAwardResponse {
  const raw = input?.data ? input.data : input; // unwrap {data:{...}}
  const transaction = normalizeTransaction(raw.transaction || raw.tx || {});
  const profile = normalizeProfile(raw.profile || {});
  return {
    transaction,
    profile,
    level_up_occurred: !!(raw.level_up_occurred ?? transaction.triggered_level_up),
    previous_level: raw.previous_level ?? transaction.previous_level ?? profile.current_level,
    achievements_unlocked: raw.achievements_unlocked || [],
    is_new_transaction: raw.is_new_transaction,
    used_default_xp: raw.used_default_xp,
    used_custom_amount: raw.used_custom_amount ?? null,
  };
}

function normalizeDashboard(input: any): GamificationDashboard {
  const raw = input?.data ?? input;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid dashboard payload');
  const profile = normalizeProfile(raw.profile ? { profile: raw.profile } : raw);
  const recent_tx = Array.isArray(raw.recent_tx)
    ? raw.recent_tx.map((t: any) => ({
        transaction_id: safeNumber(t.transaction_id),
        amount: safeNumber(t.amount),
        source: t.source,
        source_id: t.source_id ?? null,
        created_at: typeof t.created_at === 'string' ? t.created_at : new Date(t.created_at).toISOString(),
        metadata: t.metadata ?? null,
      }))
    : [];
  return {
    profile,
    recent_tx,
    preferences: raw.preferences ?? null,
  };
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username?: string | null;
  total_xp: number;
  current_level: number;
  is_current_user?: boolean;
}

export interface OrganizationLeaderboard {
  org_id: number;
  entries: LeaderboardEntry[];
  total_participants: number;
  current_user_rank?: number | null;
  last_updated: string;
}

export type StreakStatus = 'active' | 'at_risk' | 'broken' | 'none';

// Core API Functions

// Lightweight in-memory ETag/data caches per org
const _etagCache = {
  profile: new Map<number, string>(),
  dashboard: new Map<number, string>(),
};
const _dataCache = {
  profile: new Map<number, GamificationProfile>(),
  dashboard: new Map<number, GamificationDashboard>(),
};

/**
 * Get user's gamification profile for an organization
 */
export async function getGamificationProfile(orgId: number, accessToken: string): Promise<GamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const url = `${getAPIUrl()}gamification/profile/${orgId}`;
  const init = RequestBodyWithAuthHeader('GET', null, null, accessToken) as RequestInit;
  const etag = _etagCache.profile.get(orgId);
  const headers = { ...(init.headers as any) };
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 304) {
    const cached = _dataCache.profile.get(orgId);
    if (cached) return cached;
    // fall through if cache miss
  }
  const raw = await errorHandling(res);
  const data = normalizeProfile(raw);
  const newEtag = res.headers.get('ETag');
  if (newEtag) _etagCache.profile.set(orgId, newEtag);
  _dataCache.profile.set(orgId, data);
  return data;
}

/**
 * Update user's login streak
 */
export async function updateLoginStreak(orgId: number, accessToken: string): Promise<GamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/login-streak/${orgId}`,
    RequestBodyWithAuthHeader('POST', null, null, accessToken),
  );

  const raw = await errorHandling(result);
  const payload = raw?.profile ?? raw;
  const profile = normalizeProfile(payload);
  _dataCache.profile.set(orgId, profile);
  return profile;
}

/**
 * Update user's learning streak
 */
export async function updateLearningStreak(orgId: number, accessToken: string): Promise<GamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/learning-streak/${orgId}`,
    RequestBodyWithAuthHeader('POST', null, null, accessToken),
  );

  const raw = await errorHandling(result);
  const payload = raw?.profile ?? raw;
  const profile = normalizeProfile(payload);
  _dataCache.profile.set(orgId, profile);
  return profile;
}

/**
 * Get comprehensive gamification dashboard data
 */
export async function getGamificationDashboard(orgId: number, accessToken: string): Promise<GamificationDashboard> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const url = `${getAPIUrl()}gamification/dashboard/${orgId}`;
  const init = RequestBodyWithAuthHeader('GET', null, null, accessToken) as RequestInit;
  const etag = _etagCache.dashboard.get(orgId);
  const headers = { ...(init.headers as any) };
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 304) {
    const cached = _dataCache.dashboard.get(orgId);
    if (cached) return cached;
  }
  const raw = await errorHandling(res);
  const data = normalizeDashboard(raw);
  const newEtag = res.headers.get('ETag');
  if (newEtag) _etagCache.dashboard.set(orgId, newEtag);
  _dataCache.dashboard.set(orgId, data);
  return data;
}

/**
 * Get organization leaderboard
 */
export async function getOrganizationLeaderboard(
  orgId: number,
  accessToken: string,
  limit = 50,
): Promise<OrganizationLeaderboard> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }
  if (limit <= 0 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const result = await fetch(
    `${getAPIUrl()}gamification/leaderboard/${orgId}?${params}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );
  const data = await errorHandling(result);
  // Basic numeric safety for leaderboard entries
  if (data?.entries) {
    data.entries = data.entries.map((e: any) => ({
      ...e,
      total_xp: safeNumber(e.total_xp),
      current_level: safeNumber(e.current_level, 1),
    }));
  }
  return data;
}

/**
 * Award XP (idempotent)
 */
export async function awardXP(orgId: number, accessToken: string, payload: XPAwardRequest): Promise<XPAwardResponse> {
  if (!orgId) throw new Error('orgId required');
  if (!accessToken) throw new Error('access token required');
  if (!payload?.source) throw new Error('source required');

  // Backend expects query params (source, source_id, custom_amount) + idempotency via header.
  const idem = payload.idempotency_key || `xp_${payload.source}_${payload.source_id || 'generic'}_${Date.now()}`;
  const params = new URLSearchParams({ source: payload.source });
  if (payload.source_id) params.set('source_id', payload.source_id);
  // Only pass custom_amount for admin awards; router ignores for other sources
  if (payload.source === 'admin_award' && payload.custom_amount != null) {
    params.set('custom_amount', String(payload.custom_amount));
  }
  // metadata currently ignored (backend treats it as query param if provided) – send if simple
  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    try {
      params.set('metadata', encodeURIComponent(JSON.stringify(payload.metadata)));
    } catch {
      /* ignore serialization issues */
    }
  }

  const url = `${getAPIUrl()}gamification/award-xp/${orgId}?${params}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': idem,
    },
    credentials: 'include',
  });
  const raw = await errorHandling(res);
  return normalizeAwardResponse(raw);
}

/**
 * Get gamification preferences
 */
export async function getGamificationPreferences(orgId: number, accessToken: string) {
  const res = await fetch(
    `${getAPIUrl()}gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );
  return errorHandling(res);
}

/**
 * Update gamification preferences
 */
export async function updateGamificationPreferences(orgId: number, accessToken: string, preferences: any) {
  const res = await fetch(
    `${getAPIUrl()}gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('PUT', JSON.stringify({ preferences }), 'application/json', accessToken),
  );
  return errorHandling(res);
}

/**
 * Get XP sources metadata
 */
export async function getXPSourcesMetadata(): Promise<
  { key: string; label: string; description: string; default_xp: number; category: string }[]
> {
  const res = await fetch(`${getAPIUrl()}gamification/xp-sources`);
  const data = await errorHandling(res);
  return data.sources || [];
}

// Utility Functions

/**
 * Get level progression data from profile
 */
export function getLevelProgressionData(profile: GamificationProfile): {
  currentLevel: number;
  totalXP: number;
  progressPercent: number;
  xpToNextLevel: number;
} {
  return {
    currentLevel: profile.current_level,
    totalXP: profile.total_xp,
    progressPercent: Math.max(0, Math.min(100, (profile.progress || 0) * 100)),
    xpToNextLevel: profile.xp_to_next,
  };
}

/**
 * Calculate level progress percentage
 */
export function calculateLevelProgress(profile: GamificationProfile): number {
  return Math.max(0, Math.min(100, (profile.progress || 0) * 100));
}

/**
 * Get display name for XP source
 */
export function getXPSourceDisplayName(source: string): string {
  // Runtime-populated cache
  if (!(globalThis as any).__xpSourceMetaCache) {
    (globalThis as any).__xpSourceMetaCache = { loaded: false, map: {} as Record<string, string> };
  }
  const cache = (globalThis as any).__xpSourceMetaCache as { loaded: boolean; map: Record<string, string> };

  // Load cache if not loaded
  if (!cache.loaded) {
    cache.loaded = true;
    fetch(`${getAPIUrl()}gamification/xp-sources`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.sources) {
          for (const s of data.sources as any[]) {
            cache.map[s.key] = s.label;
          }
        }
      })
      .catch(() => {});
  }

  if (cache.map[source]) return cache.map[source];

  return source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format XP amount with appropriate signs and formatting
 */
export function formatXPAmount(amount: number, locale?: string): string {
  const sign = amount > 0 ? '+' : '';
  const formattedNumber = locale ? amount.toLocaleString(locale) : amount.toLocaleString();
  return `${sign}${formattedNumber} XP`;
}

/**
 * Check if a streak is at risk
 */
export function isStreakAtRisk(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  try {
    const lastDate = new Date(lastActivityDate);
    const today = new Date();

    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 1;
  } catch (error) {
    console.warn('Invalid date format in isStreakAtRisk:', lastActivityDate, error);
    return false;
  }
}

/**
 * Get streak status based on last activity date
 */
export function getStreakStatus(lastActivityDate: string | null): StreakStatus {
  if (!lastActivityDate) return 'none';

  try {
    const lastDate = new Date(lastActivityDate);
    const today = new Date();

    if (Number.isNaN(lastDate.getTime())) {
      throw new Error('Invalid date');
    }

    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'active';
    if (diffDays === 1) return 'at_risk';
    return 'broken';
  } catch (error) {
    console.warn('Invalid date format in getStreakStatus:', lastActivityDate, error);
    return 'none';
  }
}
