/**
 * Gamification Components Index
 *
 * Exports all gamification UI components
 */

// Core gamification exports
export { GamificationProfileSection } from './GamificationProfileSection';

// Dashboard cards
export { ProfileCard } from './profile-card';
export { QuickStatsCard } from './quick-stats-card';
export { RecentActivityFeed } from './recent-activity-feed';
export { LeaderboardCard } from './leaderboard-card';

// Level up celebration (used in context)
export { LevelUpCelebration } from './xp-toast';

// Re-export enhanced components from unified system
export {
  GlowingLevelBadge,
  EnhancedLevelProgress,
  MilestoneProgress,
  XPGainAnimation,
  ParticleEffect,
  useEnhancedXPToast,
} from '@/lib/gamification';
