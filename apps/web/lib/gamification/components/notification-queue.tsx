/**
 * XP Notification Queue System
 *
 * Manages multiple XP notifications with:
 * - Automatic batching of similar events
 * - Smart positioning to avoid content blocking
 * - Queue management to prevent spam
 * - Smooth transitions between notifications
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { animations } from '../design-tokens';

// ============================================================================
// Types
// ============================================================================

export interface XPNotification {
  id: string;
  amount: number;
  source: string;
  triggeredLevelUp?: boolean;
  timestamp: number;
}

export interface XPNotificationQueueOptions {
  maxVisible?: number;
  batchWindowMs?: number;
  displayDurationMs?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

interface BatchedNotification extends XPNotification {
  batchCount: number;
  totalAmount: number;
}

// ============================================================================
// Notification Queue Hook
// ============================================================================

const DEFAULT_OPTIONS: Required<XPNotificationQueueOptions> = {
  maxVisible: 3,
  batchWindowMs: 2000,
  displayDurationMs: 3000,
  position: 'bottom-right',
};

export function useXPNotificationQueue(options: XPNotificationQueueOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [queue, setQueue] = useState<BatchedNotification[]>([]);
  const [visible, setVisible] = useState<BatchedNotification[]>([]);

  // Add notification to queue with batching logic
  const addNotification = useCallback(
    (notification: Omit<XPNotification, 'id' | 'timestamp'>) => {
      const newNotification: XPNotification = {
        ...notification,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };

      setQueue((prev) => {
        // Try to batch with recent similar notifications
        const recentSimilar = prev.find(
          (n) =>
            n.source === newNotification.source && Date.now() - n.timestamp < opts.batchWindowMs && !n.triggeredLevelUp,
        );

        if (recentSimilar) {
          // Batch with existing notification
          return prev.map((n) =>
            n.id === recentSimilar.id
              ? {
                  ...n,
                  batchCount: n.batchCount + 1,
                  totalAmount: n.totalAmount + newNotification.amount,
                  timestamp: Date.now(), // Reset timestamp for batched notification
                }
              : n,
          );
        }

        // Add as new notification
        const batched: BatchedNotification = {
          ...newNotification,
          batchCount: 1,
          totalAmount: newNotification.amount,
        };

        return [...prev, batched];
      });
    },
    [opts.batchWindowMs],
  );

  // Process queue and update visible notifications
  useEffect(() => {
    const interval = setInterval(() => {
      setQueue((prev) => {
        // Remove expired notifications
        const now = Date.now();
        const active = prev.filter((n) => now - n.timestamp < opts.displayDurationMs);

        // Update visible list (respecting maxVisible limit)
        setVisible(active.slice(0, opts.maxVisible));

        return active;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [opts.displayDurationMs, opts.maxVisible]);

  // Manually dismiss a notification
  const dismissNotification = useCallback((id: string) => {
    setQueue((prev) => prev.filter((n) => n.id !== id));
    setVisible((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setQueue([]);
    setVisible([]);
  }, []);

  return {
    notifications: visible,
    addNotification,
    dismissNotification,
    clearAll,
    queueSize: queue.length,
  };
}

// ============================================================================
// Notification Container Component
// ============================================================================

interface XPNotificationContainerProps {
  notifications: BatchedNotification[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: (id: string) => void;
  renderNotification: (notification: BatchedNotification) => React.ReactNode;
}

export function XPNotificationContainer({
  notifications,
  position = 'bottom-right',
  onDismiss,
  renderNotification,
}: XPNotificationContainerProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: position.startsWith('bottom') ? 50 : -50,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 500,
        damping: 30,
      },
    },
    exit: {
      opacity: 0,
      x: position.endsWith('right') ? 100 : -100,
      scale: 0.8,
      transition: {
        duration: animations.duration.fast / 1000,
      },
    },
  };

  return (
    <motion.div
      className={`pointer-events-none fixed z-50 flex max-w-md flex-col gap-2 ${positionClasses[position]}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            className="pointer-events-auto"
          >
            {renderNotification(notification)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Batch Indicator Component
// ============================================================================

interface BatchIndicatorProps {
  count: number;
  className?: string;
}

export function BatchIndicator({ count, className }: BatchIndicatorProps) {
  if (count <= 1) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground ${className}`}
    >
      ×{count}
    </motion.div>
  );
}

// ============================================================================
// Smart Positioning Hook
// ============================================================================

export interface ContextualPosition {
  x: number;
  y: number;
  avoid?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Hook to determine smart positioning based on context
 * Avoids blocking important UI elements
 */
export function useContextualPosition(
  contextElement?: HTMLElement | null,
): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' {
  const [position, setPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('bottom-right');

  useEffect(() => {
    if (!contextElement) return;

    const rect = contextElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Calculate best position based on element location
    const isTop = rect.top < viewportHeight / 2;
    const isLeft = rect.left < viewportWidth / 2;

    if (isTop && isLeft) {
      setPosition('bottom-right');
    } else if (isTop && !isLeft) {
      setPosition('bottom-left');
    } else if (!isTop && isLeft) {
      setPosition('top-right');
    } else {
      setPosition('top-left');
    }
  }, [contextElement]);

  return position;
}
