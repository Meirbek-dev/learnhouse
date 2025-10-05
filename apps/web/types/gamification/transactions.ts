import { z } from 'zod';
import type { UserGamificationProfile } from './profile';

/**
 * XP Transactions and Award Types
 * Everything related to earning and tracking XP
 */

// XP sources - extensible for future sources
export const XP_SOURCES = {
  ACTIVITY_COMPLETION: 'activity_completion',
  COURSE_COMPLETION: 'course_completion',
  LOGIN_BONUS: 'login_bonus',
  QUIZ_COMPLETION: 'quiz_completion',
  ASSIGNMENT_SUBMISSION: 'assignment_submission',
  STREAK_BONUS: 'streak_bonus',
  ADMIN_AWARD: 'admin_award',
} as const;

export type KnownXPSource = (typeof XP_SOURCES)[keyof typeof XP_SOURCES];
export type XPSource = KnownXPSource | (string & Record<never, never>); // Allow unknown sources

// XP award request
export interface XPAwardRequest {
  source: XPSource;
  amount?: number; // Optional, backend uses defaults per source
  source_id?: string; // e.g., activity_uuid, course_uuid
  idempotency_key?: string; // For preventing duplicate awards
}

// XP transaction record
export interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  amount: number;
  source: XPSource;
  source_id: string | null;
  triggered_level_up: boolean;
  previous_level: number;
  created_at: string; // ISO timestamp
}

// XP award response (includes updated profile)
export interface XPAwardResponse {
  transaction: XPTransaction;
  profile: UserGamificationProfile;
  triggered_level_up: boolean;
  previous_level: number;
}

// Daily XP summary
export interface DailyXPSummary {
  date: string; // YYYY-MM-DD
  totalXP: number;
  transactionCount: number;
  sources: Array<{
    source: XPSource;
    amount: number;
    count: number;
  }>;
  dailyLimit: number;
  remaining: number;
}

// XP source metadata (for UI)
export interface XPSourceMetadata {
  source: XPSource;
  defaultAmount: number;
  icon: string;
  labelKey: string; // Translation key
  descriptionKey: string; // Translation key
  color: string; // Tailwind color
}

// Zod schemas
export const XPAwardRequestSchema = z.object({
  source: z.string().min(1),
  amount: z.number().positive().optional(),
  source_id: z.string().optional(),
  idempotency_key: z.string().optional(),
});

export const XPTransactionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  org_id: z.number(),
  amount: z.number(),
  source: z.string(),
  source_id: z.string().nullable(),
  triggered_level_up: z.boolean(),
  previous_level: z.number(),
  created_at: z.string(),
});

export const XPAwardResponseSchema = z.object({
  transaction: XPTransactionSchema,
  profile: z.any(), // Import would create circular dependency; validate separately
  triggered_level_up: z.boolean(),
  previous_level: z.number(),
});

export const DailyXPSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalXP: z.number().min(0),
  transactionCount: z.number().min(0),
  sources: z.array(
    z.object({
      source: z.string(),
      amount: z.number(),
      count: z.number(),
    }),
  ),
  dailyLimit: z.number().positive(),
  remaining: z.number().min(0),
});

export const XPSourceMetadataSchema = z.object({
  source: z.string(),
  defaultAmount: z.number(),
  icon: z.string(),
  labelKey: z.string(),
  descriptionKey: z.string(),
  color: z.string(),
});

// Helper functions
export function groupTransactionsBySource(transactions: XPTransaction[]): Array<{
  source: XPSource;
  amount: number;
  count: number;
}> {
  const grouped = transactions.reduce(
    (acc, tx) => {
      const existing = acc.get(tx.source);
      if (existing) {
        existing.amount += tx.amount;
        existing.count += 1;
      } else {
        acc.set(tx.source, { source: tx.source, amount: tx.amount, count: 1 });
      }
      return acc;
    },
    new Map<XPSource, { source: XPSource; amount: number; count: number }>(),
  );

  return Array.from(grouped.values());
}

export function calculateDailySummary(
  transactions: XPTransaction[],
  date: string,
  dailyLimit: number,
): DailyXPSummary {
  const dateTransactions = transactions.filter((tx) => tx.created_at.startsWith(date));
  const totalXP = dateTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const sources = groupTransactionsBySource(dateTransactions);

  return {
    date,
    totalXP,
    transactionCount: dateTransactions.length,
    sources,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - totalXP),
  };
}

export function isLevelUpTransaction(tx: XPTransaction): boolean {
  return tx.triggered_level_up;
}

export function getTransactionsByDateRange(
  transactions: XPTransaction[],
  startDate: string,
  endDate: string,
): XPTransaction[] {
  return transactions.filter((tx) => {
    const txDate = tx.created_at.split('T')[0];
    return txDate !== undefined && txDate >= startDate && txDate <= endDate;
  });
}

// XP source metadata for UI (can be moved to config)
export const XP_SOURCE_METADATA: Record<KnownXPSource, XPSourceMetadata> = {
  [XP_SOURCES.ACTIVITY_COMPLETION]: {
    source: XP_SOURCES.ACTIVITY_COMPLETION,
    defaultAmount: 25,
    icon: '✅',
    labelKey: 'gamification.sources.activityCompletion',
    descriptionKey: 'gamification.sources.activityCompletionDesc',
    color: 'text-green-500',
  },
  [XP_SOURCES.COURSE_COMPLETION]: {
    source: XP_SOURCES.COURSE_COMPLETION,
    defaultAmount: 200,
    icon: '🎓',
    labelKey: 'gamification.sources.courseCompletion',
    descriptionKey: 'gamification.sources.courseCompletionDesc',
    color: 'text-purple-500',
  },
  [XP_SOURCES.LOGIN_BONUS]: {
    source: XP_SOURCES.LOGIN_BONUS,
    defaultAmount: 10,
    icon: '🌟',
    labelKey: 'gamification.sources.loginBonus',
    descriptionKey: 'gamification.sources.loginBonusDesc',
    color: 'text-yellow-500',
  },
  [XP_SOURCES.QUIZ_COMPLETION]: {
    source: XP_SOURCES.QUIZ_COMPLETION,
    defaultAmount: 30,
    icon: '❓',
    labelKey: 'gamification.sources.quizCompletion',
    descriptionKey: 'gamification.sources.quizCompletionDesc',
    color: 'text-blue-500',
  },
  [XP_SOURCES.ASSIGNMENT_SUBMISSION]: {
    source: XP_SOURCES.ASSIGNMENT_SUBMISSION,
    defaultAmount: 75,
    icon: '📝',
    labelKey: 'gamification.sources.assignmentSubmission',
    descriptionKey: 'gamification.sources.assignmentSubmissionDesc',
    color: 'text-orange-500',
  },
  [XP_SOURCES.STREAK_BONUS]: {
    source: XP_SOURCES.STREAK_BONUS,
    defaultAmount: 50,
    icon: '🔥',
    labelKey: 'gamification.sources.streakBonus',
    descriptionKey: 'gamification.sources.streakBonusDesc',
    color: 'text-red-500',
  },
  [XP_SOURCES.ADMIN_AWARD]: {
    source: XP_SOURCES.ADMIN_AWARD,
    defaultAmount: 0,
    icon: '👑',
    labelKey: 'gamification.sources.adminAward',
    descriptionKey: 'gamification.sources.adminAwardDesc',
    color: 'text-gold-500',
  },
};
