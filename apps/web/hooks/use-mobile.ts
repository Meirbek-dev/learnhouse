import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    if ('addEventListener' in mql) {
      mql.addEventListener('change', onChange);
    } else if ('addListener' in mql) {
      // backwards compatibility
      // @ts-ignore - addListener exists on older MediaQueryList implementations
      mql.addListener(onChange);
    }

    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', onChange);
      } else if ('removeListener' in mql) {
        // @ts-ignore - removeListener exists on older MediaQueryList implementations
        mql.removeListener(onChange);
      }
    };
  }, []);

  return Boolean(isMobile);
}
