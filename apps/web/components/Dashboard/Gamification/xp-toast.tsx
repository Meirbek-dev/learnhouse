'use client';

import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getXPSourceIcon, getXPSourceColor } from '@/lib/gamification/constants';

interface XPToastProps {
  amount: number;
  source?: string;
  triggeredLevelUp?: boolean;
  position?: { x: number; y: number };
  onComplete?: () => void;
  showSourceLabel?: boolean;
}

export function XPToast({
  amount,
  source = 'default',
  triggeredLevelUp,
  position,
  onComplete,
  showSourceLabel = true,
}: XPToastProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const [isVisible, setIsVisible] = useState(true);
  const IconComponent = getXPSourceIcon(source);
  const iconColor = getXPSourceColor(source);

  // Get localized source label
  const getSourceLabel = (sourceKey: string): string => {
    const key = `xpSources.${sourceKey}` as any;
    try {
      return t(key);
    } catch {
      return t('xpSources.unknown', { source: sourceKey });
    }
  };

  const sourceLabel = getSourceLabel(source);

  useEffect(() => {
    // Auto-dismiss after 2.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 300); // Wait for exit animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.8,
            y: 20,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.8,
            y: -20,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          className={cn(
            'fixed bottom-20 right-6 z-50 flex flex-col gap-1 rounded-xl border-2 bg-background/95 px-5 py-3 shadow-2xl backdrop-blur-md',
            triggeredLevelUp
              ? 'border-yellow-500/70 bg-gradient-to-br from-yellow-500/20 to-orange-500/20'
              : 'border-primary/50 bg-primary/5',
          )}
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <IconComponent className={cn('h-6 w-6', triggeredLevelUp ? 'text-yellow-500' : iconColor)} />
            </motion.div>

            <div className="flex flex-col">
              {showSourceLabel && <span className="text-xs text-muted-foreground font-medium">{sourceLabel}</span>}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                className={cn('text-2xl font-bold', triggeredLevelUp ? 'text-yellow-500' : 'text-primary')}
              >
                +{amount} XP
              </motion.span>
            </div>
          </div>

          {triggeredLevelUp && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-1 border border-yellow-500/30"
            >
              <Sparkles className="h-3 w-3 text-yellow-500" />
              <span className="text-xs font-semibold text-yellow-500">{t('levelUp')}</span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface LevelUpCelebrationProps {
  newLevel: number;
  onDismiss: () => void;
  compact?: boolean;
}

export function LevelUpCelebration({ newLevel, onDismiss, compact = false }: LevelUpCelebrationProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  useEffect(() => {
    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (compact) {
    // Compact corner notification (less intrusive)
    return (
      <motion.div
        initial={{ opacity: 0, x: 100, y: 100 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 100 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 right-6 z-[100] rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-6 shadow-2xl backdrop-blur-md max-w-sm"
        onClick={onDismiss}
      >
        {/* Subtle sparkle effect */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 0.6, 0],
                scale: [0, 1.5, 0],
                x: [0, (Math.random() - 0.5) * 100],
                y: [0, (Math.random() - 0.5) * 100],
              }}
              transition={{
                duration: 1.5,
                delay: Math.random() * 0.5,
                repeat: 2,
              }}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-yellow-400"
            />
          ))}
        </div>

        <div className="relative flex items-center gap-4">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="shrink-0"
          >
            <div className="rounded-full bg-yellow-500/20 p-3 border-2 border-yellow-500">
              <Sparkles className="h-8 w-8 text-yellow-500" />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.h3
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl font-bold text-foreground mb-1"
            >
              {t('levelUpTitle')}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-yellow-500 font-semibold"
            >
              {t('reachedLevel', { level: newLevel })}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xs text-muted-foreground mt-1"
            >
              {t('clickAnywhereToClose')}
            </motion.p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full-screen celebration (default)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.5, rotate: 15, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative rounded-3xl border-4 border-yellow-500 bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/10 p-12 text-center shadow-2xl max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sparkles animation */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 600,
              }}
              transition={{
                duration: 2,
                delay: Math.random() * 0.8,
                repeat: 2,
              }}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50"
            />
          ))}
        </div>

        <motion.div
          animate={{
            rotate: [0, 5, -5, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 0.6,
            repeat: 3,
            repeatDelay: 0.5,
          }}
          className="relative"
        >
          <div className="inline-flex rounded-full bg-yellow-500/30 p-4 mb-4 border-4 border-yellow-500/50">
            <Sparkles className="h-20 w-20 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-3 text-5xl font-bold text-foreground drop-shadow-lg"
        >
          {t('levelUpTitle')}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="mb-6 inline-block rounded-2xl bg-yellow-500/20 px-8 py-3 border-2 border-yellow-500/50"
        >
          <p className="text-4xl font-black text-yellow-500 drop-shadow-md">{t('reachedLevel', { level: newLevel })}</p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDismiss}
          className="mt-4 rounded-xl bg-yellow-500 px-8 py-3 font-bold text-black shadow-lg shadow-yellow-500/30 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/40"
        >
          {t('continue')}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-4 text-sm text-muted-foreground"
        >
          {t('clickAnywhereToClose')}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

// Hook for managing XP toasts
export function useXPToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; props: XPToastProps }>>([]);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number; compact?: boolean } | null>(null);

  const showXPToast = (
    amount: number,
    source?: string,
    triggeredLevelUp?: boolean,
    position?: { x: number; y: number },
    showSourceLabel?: boolean,
  ) => {
    const id = Math.random().toString(36).substring(2, 11);

    setToasts((prev) => {
      // Limit to 3 toasts at once
      const filtered = prev.slice(-2);
      return [
        ...filtered,
        {
          id,
          props: {
            amount,
            source,
            triggeredLevelUp,
            position,
            showSourceLabel,
            onComplete: () => {
              setToasts((current) => current.filter((t) => t.id !== id));
            },
          },
        },
      ];
    });
  };

  const showLevelUpCelebration = (newLevel: number, compact = false) => {
    setLevelUpData({ newLevel, compact });
  };

  const dismissLevelUpCelebration = () => {
    setLevelUpData(null);
  };

  return {
    toasts,
    showXPToast,
    levelUpData,
    showLevelUpCelebration,
    dismissLevelUpCelebration,
  };
}
