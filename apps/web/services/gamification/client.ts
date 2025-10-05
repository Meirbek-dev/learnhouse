/**
 * Gamification API Client
 *
 * Type-safe client with:
 * - Automatic retry with exponential backoff
 * - Request deduplication
 * - Response caching
 * - Discriminated union error handling
 * - Optimistic updates support
 */

import type {
  DashboardData,
  GamificationError,
  OrganizationLeaderboard,
  UserGamificationProfile,
  XPAwardRequest,
  XPAwardResponse,
  StreakUpdate,
  StreakType,
} from '@/types/gamification';

import type { LeaderboardFilters, UserRank } from '@/types/gamification/leaderboard';

import {
  createAuthError,
  createServerError,
  createValidationError,
  createDailyLimitExceededError,
  createUnknownError,
  ERROR_TYPES,
} from '@/types/gamification/errors';

import {
  UserGamificationProfileSchema,
  XPAwardResponseSchema,
  StreakUpdateSchema,
} from '@/types/gamification';

// Client configuration
export interface GamificationClientConfig {
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  retryMultiplier?: number;
  timeout?: number;
  enableCache?: boolean;
  cacheDuration?: number; // milliseconds
  enableDeduplication?: boolean;
}

const DEFAULT_CONFIG: Required<GamificationClientConfig> = {
  baseUrl: '/api/gamification',
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  timeout: 30000,
  enableCache: true,
  cacheDuration: 30000, // 30 seconds
  enableDeduplication: true,
};

// Cache entry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-flight request tracker for deduplication
interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

/**
 * Type-safe Gamification API Client
 */
export class GamificationClient {
  private config: Required<GamificationClientConfig>;
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, InFlightRequest<unknown>>();

  constructor(config: GamificationClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Get complete dashboard data (profile + transactions + leaderboard)
   */
  async getDashboard(orgId: number, options?: { skipCache?: boolean }): Promise<DashboardData> {
    const cacheKey = `dashboard:${orgId}`;

    if (!options?.skipCache) {
      const cached = this.getFromCache<DashboardData>(cacheKey);
      if (cached) return cached;
    }

    const result = await this.request<{ dashboard: DashboardData; leaderboard: OrganizationLeaderboard }>(
      `${this.config.baseUrl}/${orgId}`,
      {
        method: 'GET',
        cacheKey,
        validator: (data) => {
          // Basic validation - full schema validation can be expensive
          const isValid = Boolean(data && typeof data === 'object' && 'dashboard' in data);
          return {
            success: isValid,
            data: isValid ? (data as { dashboard: DashboardData; leaderboard: OrganizationLeaderboard }) : undefined,
          };
        },
      },
    );

    // Cache the dashboard data
    if (this.config.enableCache) {
      this.setCache(cacheKey, result.dashboard);
    }

    return result.dashboard;
  }

  /**
   * Get user profile only
   */
  async getProfile(orgId: number, options?: { skipCache?: boolean }): Promise<UserGamificationProfile> {
    const dashboard = await this.getDashboard(orgId, options);
    return dashboard.profile;
  }

  /**
   * Get leaderboard entries
   * Note: Uses unified endpoint that returns dashboard + leaderboard
   */
  async getLeaderboard(
    orgId: number,
    filters?: Partial<LeaderboardFilters>,
    options?: { skipCache?: boolean },
  ): Promise<OrganizationLeaderboard> {
    const cacheKey = `leaderboard:${orgId}:${JSON.stringify(filters || {})}`;

    if (!options?.skipCache) {
      const cached = this.getFromCache<OrganizationLeaderboard>(cacheKey);
      if (cached) return cached;
    }

    // Use unified endpoint - GET /api/gamification/[orgId] returns { dashboard, leaderboard }
    const url = `${this.config.baseUrl}/${orgId}`;

    const result = await this.request<{ dashboard: DashboardData; leaderboard: OrganizationLeaderboard }>(url, {
      method: 'GET',
    });

    // Cache and return just the leaderboard part
    this.setCache(cacheKey, result.leaderboard);
    return result.leaderboard;
  }

  /**
   * Get current user's rank
   * Note: Extracted from dashboard data
   */
  async getUserRank(orgId: number, options?: { skipCache?: boolean }): Promise<UserRank | null> {
    const dashboard = await this.getDashboard(orgId, options);

    // Build UserRank from dashboard data
    if (dashboard.user_rank === null) {
      return null;
    }

    return {
      user_id: dashboard.profile.user_id,
      rank: dashboard.user_rank,
      total_participants: dashboard.leaderboard.total_participants,
      percentile: dashboard.user_rank > 0
        ? ((dashboard.leaderboard.total_participants - dashboard.user_rank) / dashboard.leaderboard.total_participants) * 100
        : 0,
      rank_change: 0, // Not available from current API
    };
  }

  /**
   * Award XP to user
   */
  async awardXP(orgId: number, request: XPAwardRequest): Promise<XPAwardResponse> {
    // Never cache mutations
    const result = await this.request<XPAwardResponse>(
      `${this.config.baseUrl}/${orgId}`,
      {
        method: 'POST',
        body: JSON.stringify({ action: 'award_xp', ...request }),
        headers: { 'Content-Type': 'application/json' },
        validator: XPAwardResponseSchema.safeParse,
      },
      { skipRetry: false }, // Retry is safe due to idempotency_key
    );

    // Invalidate related caches
    this.invalidateCache(`dashboard:${orgId}`);
    this.invalidateCache(`profile:${orgId}`);
    this.invalidateCachePattern(`leaderboard:${orgId}`);

    return result;
  }

  /**
   * Update streak (login or learning)
   * Uses action-based API: POST /api/gamification/[orgId] with action body
   */
  async updateStreak(orgId: number, type: StreakType): Promise<StreakUpdate> {
    const result = await this.request<StreakUpdate>(`${this.config.baseUrl}/${orgId}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'update_streak', streak_type: type }),
      headers: { 'Content-Type': 'application/json' },
      validator: StreakUpdateSchema.safeParse,
    });

    // Invalidate caches
    this.invalidateCache(`dashboard:${orgId}`);
    this.invalidateCache(`profile:${orgId}`);

    return result;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(orgId: number, preferences: Record<string, unknown>): Promise<UserGamificationProfile> {
    const result = await this.request<UserGamificationProfile>(
      `${this.config.baseUrl}/${orgId}`,
      {
        method: 'POST',
        body: JSON.stringify({ action: 'update_preferences', preferences }),
        headers: { 'Content-Type': 'application/json' },
        validator: UserGamificationProfileSchema.safeParse,
      },
    );

    // Invalidate caches
    this.invalidateCache(`dashboard:${orgId}`);
    this.invalidateCache(`profile:${orgId}`);

    return result;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate specific cache entry
   */
  invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching pattern
   */
  invalidateCachePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Invalidate all caches for an organization
   */
  invalidateOrganization(orgId: number): void {
    this.invalidateCachePattern(`dashboard:${orgId}`);
    this.invalidateCachePattern(`profile:${orgId}`);
    this.invalidateCachePattern(`leaderboard:${orgId}`);
    this.invalidateCachePattern(`rank:${orgId}`);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCache) return null;

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.config.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    if (!this.config.enableCache) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private async request<T>(
    url: string,
    options: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      body?: string;
      headers?: Record<string, string>;
      cacheKey?: string;
      validator?: (data: unknown) => { success: boolean; data?: T };
    },
    retryOptions?: { skipRetry?: boolean },
  ): Promise<T> {
    const { method, body, headers, cacheKey, validator } = options;

    // Request deduplication for GET requests
    if (method === 'GET' && cacheKey && this.config.enableDeduplication) {
      const inFlight = this.inFlight.get(cacheKey) as InFlightRequest<T> | undefined;
      if (inFlight) {
        // Reuse existing request
        return inFlight.promise;
      }
    }

    const requestPromise = this.executeRequest<T>(url, { method, body, headers, validator }, retryOptions);

    // Track in-flight request
    if (method === 'GET' && cacheKey && this.config.enableDeduplication) {
      this.inFlight.set(cacheKey, {
        promise: requestPromise,
        timestamp: Date.now(),
      });

      // Clean up after completion
      requestPromise.finally(() => {
        this.inFlight.delete(cacheKey);
      });
    }

    return requestPromise;
  }

  private async executeRequest<T>(
    url: string,
    options: {
      method: string;
      body?: string;
      headers?: Record<string, string>;
      validator?: (data: unknown) => { success: boolean; data?: T };
    },
    retryOptions?: { skipRetry?: boolean },
    attempt = 1,
  ): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: options.method,
        body: options.body,
        headers: options.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();

      // Validate response if validator provided
      if (options.validator) {
        const validation = options.validator(data);
        if (!validation.success) {
          throw createValidationError('Invalid response format', [
            { field: 'response', message: 'Response does not match expected schema' },
          ]);
        }
        return validation.data as T;
      }

      return data as T;
    } catch (error) {
      // Handle retry logic
      if (
        !retryOptions?.skipRetry &&
        attempt < this.config.maxRetries &&
        this.shouldRetry(error as GamificationError)
      ) {
        const delay = this.config.retryDelay * Math.pow(this.config.retryMultiplier, attempt - 1);
        await this.sleep(delay);
        return this.executeRequest<T>(url, options, retryOptions, attempt + 1);
      }

      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<GamificationError> {
    let errorData: { error?: string; message?: string; detail?: string };

    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    const message = errorData.error || errorData.message || errorData.detail || 'Unknown error';

    // Map HTTP status to error types
    switch (response.status) {
      case 401:
      case 403:
        return createAuthError(message, response.status === 401);

      case 429:
        // Daily limit exceeded
        return createDailyLimitExceededError(message, 0, 500, new Date().toISOString());

      case 400:
        return createValidationError(message, [{ field: 'request', message }]);

      case 404:
        return createServerError(message, response.status);

      case 500:
      case 502:
      case 503:
      case 504:
        return createServerError(message, response.status);

      default:
        if (response.status >= 500) {
          return createServerError(message, response.status);
        }
        return createUnknownError(message);
    }
  }

  private shouldRetry(error: GamificationError): boolean {
    // Retry on network errors and 5xx server errors
    if (error.type === ERROR_TYPES.NETWORK_ERROR) {
      return (error as { retryable?: boolean }).retryable ?? true;
    }

    if (error.type === ERROR_TYPES.SERVER_ERROR) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      return statusCode ? statusCode >= 500 : false;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let clientInstance: GamificationClient | null = null;

/**
 * Get or create singleton client instance
 */
export function getGamificationClient(config?: GamificationClientConfig): GamificationClient {
  if (!clientInstance) {
    clientInstance = new GamificationClient(config);
  }
  return clientInstance;
}

/**
 * Reset client instance (useful for testing)
 */
export function resetGamificationClient(): void {
  clientInstance = null;
}

// Export convenience methods
export const gamificationApi = {
  getDashboard: (orgId: number, options?: { skipCache?: boolean }) =>
    getGamificationClient().getDashboard(orgId, options),
  getProfile: (orgId: number, options?: { skipCache?: boolean }) => getGamificationClient().getProfile(orgId, options),
  getLeaderboard: (orgId: number, filters?: Partial<LeaderboardFilters>, options?: { skipCache?: boolean }) =>
    getGamificationClient().getLeaderboard(orgId, filters, options),
  getUserRank: (orgId: number, options?: { skipCache?: boolean }) => getGamificationClient().getUserRank(orgId, options),
  awardXP: (orgId: number, request: XPAwardRequest) => getGamificationClient().awardXP(orgId, request),
  updateStreak: (orgId: number, type: StreakType) => getGamificationClient().updateStreak(orgId, type),
  updatePreferences: (orgId: number, preferences: Record<string, unknown>) =>
    getGamificationClient().updatePreferences(orgId, preferences),
  clearCache: () => getGamificationClient().clearCache(),
  invalidateOrganization: (orgId: number) => getGamificationClient().invalidateOrganization(orgId),
};
