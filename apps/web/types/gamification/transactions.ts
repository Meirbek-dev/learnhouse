import type { UserGamificationProfile } from './profile';
import { z } from 'zod';

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

export type XPSource = (typeof XP_SOURCES)[keyof typeof XP_SOURCES];

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
