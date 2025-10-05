/**
 * Gamification Components Index
 *
 * Exports all gamification UI components with centralized constants
 */

// Core gamification exports
export { Leaderboard } from './leaderboard';
export { GamificationProfileSection } from './GamificationProfileSection';

// Dashboard cards
export { ProfileCard } from './profile-card';
export { QuickStatsCard } from './quick-stats-card';
export { RecentActivityFeed } from './recent-activity-feed';
export { LeaderboardCard } from './leaderboard-card';

// Level indicators (simplified version)
export { LevelBadge, LevelProgress, LevelUpAnimation } from './level-indicators';

// XP Toast notifications
export { XPToast, LevelUpCelebration, useXPToast } from './xp-toast';
