/**
 * Gamification System - Unified Exports
 *
 * Single import point for all gamification utilities and components.
 */

// Design System
export * from './design-tokens';
export * from './levels';

// Theme system (preferred over constants)
export {
  getXPSourceTheme,
  getRankTheme,
  getLevelTheme,
  type XPSourceTheme,
  type RankTheme,
  type LevelTheme,
} from './theme';

// Utilities
export * from './components/animated-value';
export * from './components/empty-state';
export * from './components/loading-state';

// Phase 2: New Components
export * from './components/card-primitives';
export * from './components/notification-queue';
export * from './components/enhanced-level-indicators';
export * from './components/enhanced-xp-toast';
