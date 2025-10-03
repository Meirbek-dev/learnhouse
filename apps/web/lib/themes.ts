/**
 * Theme system core
 * Re-exports and utility functions for theme management
 */

// Import types and utilities
import type { Theme, ThemeColors } from './theme-utils';
import { CSS_VARIABLE_MAP } from './theme-utils';

// Re-export theme definitions from separate file
export { defaultTheme, themes } from './theme-definitions';
// Re-export types and utilities from theme-utils
export type { Theme, ThemeColors } from './theme-utils';
export { CSS_VARIABLE_MAP, createThemeFromCSS } from './theme-utils';

// Import for use in utility functions
import { defaultTheme, themes } from './theme-definitions';

/**
 * Type for valid theme names
 */
export type ThemeName = (typeof themes)[number]['name'];

/**
 * Get theme by name with type-safe fallback to default theme
 *
 * @param name - The name of the theme to retrieve
 * @returns The requested theme or the default theme if not found
 */
export function getTheme(name: string): Readonly<Theme> {
  const theme = themes.find((t) => t.name === name);
  return theme ?? defaultTheme;
}

/**
 * Apply theme colors to CSS variables on the document root
 * Uses the CSS_VARIABLE_MAP for consistent variable naming
 *
 * @param theme - The theme to apply
 */
export function applyTheme(theme: Readonly<Theme>): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const { colors, radius, name } = theme;

  // Apply color variables using the CSS variable map
  (Object.entries(CSS_VARIABLE_MAP) as [keyof ThemeColors, string][]).forEach(([colorKey, cssVarName]) => {
    root.style.setProperty(`--${cssVarName}`, colors[colorKey]);
  });

  // Apply radius
  root.style.setProperty('--radius', radius);

  // Store theme preference
  localStorage.setItem('theme', name);
}

/**
 * Get stored theme preference
 */
export function getStoredTheme(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('theme');
}
