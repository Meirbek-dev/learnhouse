/**
 * useReducedData Hook
 *
 * Detects users on slow/expensive connections via:
 * 1. prefers-reduced-data (new standard)
 * 2. navigator.connection.saveData
 * 3. navigator.connection.effectiveType (slow-2g, 2g)
 *
 * Returns true if user prefers reduced data usage.
 */

import { useEffect, useState } from 'react';

export function useReducedData(): boolean {
  const [prefersReducedData, setPrefersReducedData] = useState(() => {
    if (typeof window === 'undefined') return false;

    // Check multiple signals
    let reduced = false;

    // 1. Check prefers-reduced-data media query (new standard)
    const mediaQuery = window.matchMedia('(prefers-reduced-data: reduce)');
    if (mediaQuery.matches) {
      reduced = true;
    }

    // 2. Check Network Information API (saveData)
    const connection =
      (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      // Check saveData
      if (connection.saveData) {
        reduced = true;
      }
      // Check slow connection types
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        reduced = true;
      }
    }

    return reduced;
  });

  useEffect(() => {
    // Check multiple signals
    let reduced = false;

    // 1. Check prefers-reduced-data media query (new standard)
    const mediaQuery = window.matchMedia('(prefers-reduced-data: reduce)');
    if (mediaQuery.matches) {
      reduced = true;
    }

    // 2. Check Network Information API (saveData)
    const connection =
      (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      if (connection.saveData === true) {
        reduced = true;
      }

      // 3. Check effective connection type (slow-2g, 2g)
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        reduced = true;
      }
    }

    // Listen for changes to prefers-reduced-data
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedData(event.matches);
    };

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', handleChange);
    } else if ('addListener' in mediaQuery) {
      // Backwards compatibility
      // @ts-ignore
      mediaQuery.addListener(handleChange);
    }

    // Listen for network changes
    if (connection) {
      const handleNetworkChange = () => {
        const saveData = connection.saveData === true;
        const slowConnection = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
        setPrefersReducedData(saveData || slowConnection);
      };

      if ('addEventListener' in connection) {
        connection.addEventListener('change', handleNetworkChange);
      } else if ('onchange' in connection) {
        // @ts-ignore
        connection.onchange = handleNetworkChange;
      }

      return () => {
        if ('removeEventListener' in mediaQuery) {
          mediaQuery.removeEventListener('change', handleChange);
        } else if ('removeListener' in mediaQuery) {
          // @ts-ignore
          mediaQuery.removeListener(handleChange);
        }

        if (connection) {
          if ('removeEventListener' in connection) {
            connection.removeEventListener('change', handleNetworkChange);
          } else if ('onchange' in connection) {
            // @ts-ignore
            connection.onchange = null;
          }
        }
      };
    }

    return () => {
      if ('removeEventListener' in mediaQuery) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if ('removeListener' in mediaQuery) {
        // @ts-ignore
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return prefersReducedData;
}
