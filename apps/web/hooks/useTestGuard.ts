'use client';

import { useEffect, useRef } from 'react';

type ViolationType = 'BLUR' | 'DEVTOOLS' | 'COPY' | 'RESIZE' | 'CONTEXTMENU' | 'KEYDOWN';

interface Violation {
  type: ViolationType;
  timestamp: number;
}

interface UseTestGuardOptions {
  onViolation: (type: ViolationType, count: number) => void;
  maxViolations?: number;
  enabled?: boolean;
  preventCopy?: boolean;
  trackBlur?: boolean;
  trackDevTools?: boolean;
}

/**
 * React hook for quiz anti-cheat protection.
 *
 * Features:
 * - Tracks tab blur/focus loss
 * - Detects DevTools opening (heuristic)
 * - Prevents copy/paste
 * - Blocks context menu
 * - Intercepts common keyboard shortcuts
 * - Maintains violation count and history
 */
export function useTestGuard({
  onViolation,
  maxViolations = 2,
  enabled = true,
  preventCopy = true,
  trackBlur = true,
  trackDevTools = true,
}: UseTestGuardOptions) {
  const violations = useRef<Violation[]>([]);
  const locked = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handlers: (() => void)[] = [];

    const report = (type: ViolationType) => {
      if (locked.current || !enabled) return;

      const violation: Violation = {
        type,
        timestamp: Date.now(),
      };

      violations.current.push(violation);
      const count = violations.current.length;

      onViolation(type, count);

      if (count >= maxViolations) {
        locked.current = true;
      }
    };

    // 1. Blur/Focus tracking
    if (trackBlur) {
      const onBlur = () => report('BLUR');
      const onVisibility = () => {
        if (document.hidden) report('BLUR');
      };

      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);

      handlers.push(() => {
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibility);
      });
    }

    // 2. DevTools detection (heuristic)
    if (trackDevTools) {
      const threshold = 160;
      let lastWidth = window.outerWidth;
      let lastHeight = window.outerHeight;

      const checkDevTools = () => {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        const sizeChange =
          Math.abs(window.outerWidth - lastWidth) > 100 || Math.abs(window.outerHeight - lastHeight) > 100;

        if ((widthDiff > threshold || heightDiff > threshold) && sizeChange) {
          report('DEVTOOLS');
          lastWidth = window.outerWidth;
          lastHeight = window.outerHeight;
        }
      };

      const interval = setInterval(checkDevTools, 1000);

      handlers.push(() => clearInterval(interval));
    }

    // 3. Copy/Paste/Context menu prevention
    if (preventCopy) {
      const prevent = (e: Event) => {
        e.preventDefault();
        const eventType = e.type.toUpperCase() as ViolationType;
        report(eventType === 'CONTEXTMENU' ? 'CONTEXTMENU' : 'COPY');
      };

      document.addEventListener('copy', prevent);
      document.addEventListener('cut', prevent);
      document.addEventListener('paste', prevent);
      document.addEventListener('contextmenu', prevent);

      handlers.push(() => {
        document.removeEventListener('copy', prevent);
        document.removeEventListener('cut', prevent);
        document.removeEventListener('paste', prevent);
        document.removeEventListener('contextmenu', prevent);
      });

      // 4. Keyboard shortcuts
      const keydown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'u', 's', 'p', 'x'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          report('KEYDOWN');
        }
      };

      document.addEventListener('keydown', keydown);

      handlers.push(() => {
        document.removeEventListener('keydown', keydown);
      });
    }

    // 5. Warn before leaving
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnload);
    handlers.push(() => window.removeEventListener('beforeunload', beforeUnload));

    // Cleanup all handlers
    return () => {
      handlers.forEach((cleanup) => cleanup());
    };
  }, [enabled, preventCopy, trackBlur, trackDevTools, maxViolations, onViolation]);

  return {
    isLocked: () => locked.current,
    getCount: () => violations.current.length,
    getViolations: () => violations.current,
    reset: () => {
      violations.current = [];
      locked.current = false;
    },
  };
}
