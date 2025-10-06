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
  const [prefersReducedData, setPrefersReducedData] = useState(false);

  useEffect(() => {
    // Check multiple signals
    let reduced = false;

    // 1. Check prefers-reduced-data media query (new standard)
    const mediaQuery = window.matchMedia('(prefers-reduced-data: reduce)');
    if (mediaQuery.matches) {
      reduced = true;
    }

    // 2. Check Network Information API (saveData)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      if (connection.saveData === true) {
        reduced = true;
      }

      // 3. Check effective connection type (slow-2g, 2g)
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        reduced = true;
      }
    }

    setPrefersReducedData(reduced);

    // Listen for changes to prefers-reduced-data
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedData(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Listen for network changes
    if (connection) {
      const handleNetworkChange = () => {
        const saveData = connection.saveData === true;
        const slowConnection = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
        setPrefersReducedData(saveData || slowConnection);
      };

      connection.addEventListener('change', handleNetworkChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
        connection.removeEventListener('change', handleNetworkChange);
      };
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedData;
}
