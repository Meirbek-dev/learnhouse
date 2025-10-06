import { z } from 'zod';

/**
 * Leaderboard Types
 * Rankings and competitive features
 */

// Leaderboard entry for a single user
export interface LeaderboardEntry {
  user_id: number;
  username: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  total_xp: number;
  level: number;
  rank: number;
  // Additional computed fields
  is_current_user?: boolean;
  rank_change?: number; // Positive = moved up, negative = moved down, 0 = no change
  badge?: LeaderboardBadge | null; // Top 3 get special badges
}

// Leaderboard badge types
export type LeaderboardBadge = 'gold' | 'silver' | 'bronze';

// Organization leaderboard
export interface OrganizationLeaderboard {
  entries: LeaderboardEntry[];
  total_participants: number;
  last_updated: string; // ISO timestamp
}

// Leaderboard filters
export interface LeaderboardFilters {
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  scope?: 'organization' | 'friends' | 'global';
  limit?: number;
  offset?: number;
}

// User's rank information
export interface UserRank {
  rank: number;
  total_participants: number;
  percentile: number; // 0-100
  is_top_10: boolean;
  is_top_50: boolean;
  rank_badge: LeaderboardBadge | null;
}

// Zod schemas
export const LeaderboardEntrySchema = z.object({
  user_id: z.number(),
  username: z.string().nullable(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  total_xp: z.number().min(0),
  level: z.number().min(1),
  rank: z.number().min(1),
  is_current_user: z.boolean().optional(),
  rank_change: z.number().optional(),
  badge: z.enum(['gold', 'silver', 'bronze']).nullable().optional(),
});

export const OrganizationLeaderboardSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  total_participants: z.number().min(0),
  last_updated: z.string(),
});

export const LeaderboardFiltersSchema = z.object({
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'all-time']).optional(),
  scope: z.enum(['organization', 'friends', 'global']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

export const UserRankSchema = z.object({
  rank: z.number().min(1),
  total_participants: z.number().min(0),
  percentile: z.number().min(0).max(100),
  is_top_10: z.boolean(),
  is_top_50: z.boolean(),
  rank_badge: z.enum(['gold', 'silver', 'bronze']).nullable(),
});

// Helper functions
export function assignBadges(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.map((entry, index) => {
    let badge: LeaderboardBadge | null = null;
    if (entry.rank === 1) badge = 'gold';
    else if (entry.rank === 2) badge = 'silver';
    else if (entry.rank === 3) badge = 'bronze';

    return { ...entry, badge };
  });
}

export function markCurrentUser(entries: LeaderboardEntry[], currentUserId: number): LeaderboardEntry[] {
  return entries.map((entry) => ({
    ...entry,
    is_current_user: entry.user_id === currentUserId,
  }));
}

export function calculateRankChange(currentRank: number, previousRank: number | undefined): number {
  if (previousRank === undefined) return 0;
  // Positive = improved (moved up = lower rank number)
  return previousRank - currentRank;
}

export function calculatePercentile(rank: number, totalParticipants: number): number {
  if (totalParticipants === 0) return 0;
  return Math.round(((totalParticipants - rank + 1) / totalParticipants) * 100);
}

export function findUserInLeaderboard(leaderboard: OrganizationLeaderboard, userId: number): LeaderboardEntry | null {
  return leaderboard.entries.find((entry) => entry.user_id === userId) ?? null;
}

export function getNearbyEntries(leaderboard: OrganizationLeaderboard, userId: number, range = 2): LeaderboardEntry[] {
  const userIndex = leaderboard.entries.findIndex((entry) => entry.user_id === userId);
  if (userIndex === -1) return [];

  const start = Math.max(0, userIndex - range);
  const end = Math.min(leaderboard.entries.length, userIndex + range + 1);

  return leaderboard.entries.slice(start, end);
}

export function getTopEntries(leaderboard: OrganizationLeaderboard, limit = 10): LeaderboardEntry[] {
  return leaderboard.entries.slice(0, limit);
}

export function enrichUserRank(
  leaderboard: OrganizationLeaderboard,
  userId: number,
  previousRank?: number,
): UserRank | null {
  const userEntry = findUserInLeaderboard(leaderboard, userId);
  if (!userEntry) return null;

  const percentile = calculatePercentile(userEntry.rank, leaderboard.total_participants);

  return {
    rank: userEntry.rank,
    total_participants: leaderboard.total_participants,
    percentile,
    is_top_10: userEntry.rank <= 10,
    is_top_50: userEntry.rank <= 50,
    rank_badge: userEntry.badge ?? null,
  };
}
