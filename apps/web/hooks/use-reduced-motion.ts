/**
 * useReducedMotion Hook
 *
 * Respects user's system preference for reduced motion (prefers-reduced-motion).
 * Returns true if user prefers reduced motion.
 */

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    // Check media query on mount
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}
