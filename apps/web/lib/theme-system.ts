/**
 * Theme system exports
 * Centralized exports for theme-related components and utilities
 */

// Re-export theme components
export { ThemeSelector } from '@components/ui/custom/theme-selector';
export { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
// Re-export all themes and utilities
export {
  applyTheme,
  CSS_VARIABLE_MAP,
  createThemeFromCSS,
  defaultTheme,
  getStoredTheme,
  getTheme,
  type Theme,
  type ThemeColors,
  themes,
} from '@/lib/themes';
