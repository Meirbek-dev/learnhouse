/**
 * Gamification Constants & Icon Registry
 *
 * Centralized configuration for:
 * - Icon mappings (XP sources, activities, ranks)
 * - Color schemes (levels, rarities, ranks)
 * - Animation timings
 * - Default values and limits
 */

import {
  Award,
  Crown,
  Flame,
  Medal,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ===================================
// XP SOURCES & ICONS
// ===================================

export const XP_SOURCE_ICONS: Record<string, LucideIcon> = {
  activity_completion: Award,
  course_completion: Sparkles,
  quiz_completion: Zap,
  assignment_submission: Trophy,
  streak_bonus: TrendingUp,
  login_bonus: Zap,
  daily_login: Zap,
  default: Award,
} as const;

export const XP_SOURCE_COLORS: Record<string, string> = {
  activity_completion: 'text-blue-500',
  course_completion: 'text-purple-500',
  quiz_completion: 'text-yellow-500',
  assignment_submission: 'text-green-500',
  streak_bonus: 'text-orange-500',
  login_bonus: 'text-cyan-500',
  daily_login: 'text-cyan-500',
  default: 'text-gray-500',
} as const;

// ===================================
// RANK ICONS & COLORS
// ===================================

export const RANK_ICONS: Record<number, LucideIcon> = {
  1: Trophy,
  2: Medal,
  3: Award,
} as const;

export const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-600',
} as const;

export const RANK_BG_COLORS: Record<number, string> = {
  1: 'bg-yellow-500/10',
  2: 'bg-gray-400/10',
  3: 'bg-amber-600/10',
} as const;

// ===================================
// LEVEL ICONS & COLORS
// ===================================

export const LEVEL_ICONS: Record<number, LucideIcon> = {
  1: Target,
  5: Star,
  10: Zap,
  15: Trophy,
  25: Crown,
  50: Crown,
} as const;

export const LEVEL_COLORS: Record<number, string> = {
  1: 'text-gray-500',
  5: 'text-blue-500',
  10: 'text-purple-500',
  15: 'text-green-500',
  25: 'text-orange-500',
  50: 'text-red-500',
} as const;

// ===================================
// RARITY COLORS
// ===================================

export const RARITY_COLORS = {
  common: 'text-gray-500',
  rare: 'text-blue-500',
  epic: 'text-purple-500',
  legendary: 'text-orange-500',
} as const;

export const RARITY_BG_COLORS = {
  common: 'bg-gray-500/10',
  rare: 'bg-blue-500/10',
  epic: 'bg-purple-500/10',
  legendary: 'bg-orange-500/10',
} as const;

export const RARITY_BORDER_COLORS = {
  common: 'border-gray-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-orange-500',
} as const;

// ===================================
// ANIMATION TIMINGS
// ===================================

export const ANIMATION_DURATIONS = {
  toast: 3000, // XP toast display duration
  levelUp: 5000, // Level up celebration duration
  fadeIn: 200, // Fade in animation
  fadeOut: 300, // Fade out animation
  slideIn: 300, // Slide in animation
  bounce: 600, // Bounce animation
} as const;

export const ANIMATION_EASING = {
  default: 'ease-in-out',
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ===================================
// GAMIFICATION LIMITS & DEFAULTS
// ===================================

export const GAMIFICATION_LIMITS = {
  maxLevel: 100,
  dailyXPLimit: 500,
  maxLeaderboardEntries: 100,
  defaultLeaderboardLimit: 20,
  maxRecentTransactions: 50,
} as const;

export const DEFAULT_VALUES = {
  initialXP: 0,
  initialLevel: 1,
  initialStreak: 0,
  toastPosition: { x: 0, y: 0 },
} as const;

// ===================================
// STREAK ICONS & COLORS
// ===================================

export const STREAK_ICONS = {
  login: Flame,
  learning: Flame,
  bonus: TrendingUp,
} as const;

export const STREAK_COLORS = {
  active: 'text-orange-500',
  inactive: 'text-gray-400',
  bonus: 'text-yellow-500',
} as const;

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Get icon for XP source with fallback
 */
export function getXPSourceIcon(source: string): LucideIcon {
  return (XP_SOURCE_ICONS[source] ?? XP_SOURCE_ICONS.default)!;
}

/**
 * Get color for XP source with fallback
 */
export function getXPSourceColor(source: string): string {
  return (XP_SOURCE_COLORS[source] ?? XP_SOURCE_COLORS.default)!;
}

/**
 * Get icon for rank with fallback
 */
export function getRankIcon(rank: number): LucideIcon | null {
  return RANK_ICONS[rank] || null;
}

/**
 * Get color for rank with fallback
 */
export function getRankColor(rank: number): string {
  return RANK_COLORS[rank] || 'text-gray-500';
}

/**
 * Get background color for rank with fallback
 */
export function getRankBgColor(rank: number): string {
  return RANK_BG_COLORS[rank] || 'bg-gray-500/10';
}

/**
 * Get icon for level (finds closest milestone)
 */
export function getLevelIcon(level: number): LucideIcon {
  const milestones = Object.keys(LEVEL_ICONS).map(Number).sort((a, b) => b - a);
  const milestone = milestones.find((m) => level >= m) || 1;
  return (LEVEL_ICONS[milestone] ?? LEVEL_ICONS[1])!;
}

/**
 * Get color for level (finds closest milestone)
 */
export function getLevelColor(level: number): string {
  const milestones = Object.keys(LEVEL_COLORS).map(Number).sort((a, b) => b - a);
  const milestone = milestones.find((m) => level >= m) || 1;
  return (LEVEL_COLORS[milestone] ?? LEVEL_COLORS[1])!;
}
