'use client';

import { useEffect, useRef } from 'react';

type ViolationType = 'BLUR' | 'DEVTOOLS' | 'COPY' | 'RESIZE' | 'CONTEXTMENU' | 'KEYDOWN' | 'FULLSCREEN_EXIT';

interface Violation {
  type: ViolationType;
  timestamp: number;
}

interface UseTestGuardOptions {
  onViolation: (type: ViolationType, count: number) => void;
  maxViolations?: number;
  enabled?: boolean;
  preventCopy?: boolean;
  preventRightClick?: boolean;
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
  preventRightClick = true,
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

      // Debug logging to help diagnose false positives
      try {
        if (process.env.NODE_ENV !== 'production') {
          // Capture helpful context: active element and simple stack
          const active = document.activeElement;
          console.debug('[useTestGuard] report', { type, activeTag: active?.tagName, activeId: (active as HTMLElement | null)?.id, activeClasses: (active as HTMLElement | null)?.className });
        }
      } catch (err) {
        // ignore logging errors
        void err;
      }

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

    // 3. Copy/Paste/Context menu prevention (hardened to reduce false positives)
    if (preventCopy || preventRightClick) {
      const preventClipboard = (e: ClipboardEvent) => {
        try {
          // Only consider clipboard events if there is an actual selection or pasted text
          if (e.type === 'copy' || e.type === 'cut') {
            const sel = typeof window.getSelection === 'function' ? window.getSelection()?.toString() : '';
            if (!sel) return;
          }
          if (e.type === 'paste') {
            const data = e.clipboardData?.getData('text') ?? '';
            if (!data) return;
          }
        } catch {
          // In case of unexpected environment, be conservative and ignore
          return;
        }

        e.preventDefault();
        report('COPY');
      };

      if (preventCopy) {
        document.addEventListener('copy', preventClipboard);
        document.addEventListener('cut', preventClipboard);
        document.addEventListener('paste', preventClipboard);

        handlers.push(() => {
          document.removeEventListener('copy', preventClipboard);
          document.removeEventListener('cut', preventClipboard);
          document.removeEventListener('paste', preventClipboard);
        });
      }

      if (preventRightClick) {
        const preventContext = (e: MouseEvent) => {
          // Only treat real right-clicks (button === 2) as violations; ignore synthetic or left-click contextmenu
          if (typeof e.button === 'number' && e.button !== 2) return;
          e.preventDefault();
          report('CONTEXTMENU');
        };
        document.addEventListener('contextmenu', preventContext);
        handlers.push(() => {
          document.removeEventListener('contextmenu', preventContext);
        });
      }

      // 4. Keyboard shortcuts - only when not typing in an input/textarea/contentEditable
      const keydown = (e: KeyboardEvent) => {
        const active = document.activeElement as HTMLElement | null;
        const isEditable =
          !!active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            // contentEditable check
            (active.getAttribute && active.getAttribute('contenteditable') === 'true'));

        if (isEditable) return;

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
  }, [enabled, preventCopy, preventRightClick, trackBlur, trackDevTools, maxViolations, onViolation]);

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
