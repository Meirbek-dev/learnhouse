/**
 * Theme system exports
 * Centralized exports for theme-related components and utilities
 */

// Re-export all themes and utilities
export {
  applyTheme,
  createThemeFromCSS,
  CSS_VARIABLE_MAP,
  defaultTheme,
  getStoredTheme,
  getTheme,
  themes,
  type Theme,
  type ThemeColors,
} from '@/lib/themes';

// Re-export theme components
export { ThemeSelector } from '@components/ui/custom/theme-selector';
export { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
