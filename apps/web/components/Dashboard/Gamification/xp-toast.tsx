/**
 * Level Up Celebration Component
 *
 * Respects mobile, reduced-motion, and reduced-data preferences.
 * Mobile: Always uses compact mode.
 * Reduced motion: Simplified animations.
 * Reduced data: Skip particle effects, use lighter animations.
 */

'use client';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useReducedData } from '@/hooks/use-reduced-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface LevelUpCelebrationProps {
  newLevel: number;
  onDismiss: () => void;
  compact?: boolean;
}

export function LevelUpCelebration({ newLevel, onDismiss, compact = false }: LevelUpCelebrationProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const prefersReducedData = useReducedData();

  // Force compact mode on mobile or reduced data
  const shouldUseCompact = compact || isMobile || prefersReducedData;

  // Generate random values once for particle animations to avoid purity violations
  // Use useState with lazy initialization to compute Math.random() only once
  const [compactParticles] = useState(() =>
    Array.from({ length: 8 }, () => ({
      xOffset: (Math.random() - 0.5) * 100,
      yOffset: (Math.random() - 0.5) * 100,
      delay: Math.random() * 0.5,
    })),
  );

  const [fullscreenParticles] = useState(() =>
    Array.from({ length: 30 }, () => ({
      xOffset: (Math.random() - 0.5) * 600,
      yOffset: (Math.random() - 0.5) * 600,
      delay: Math.random() * 0.8,
    })),
  );

  useEffect(() => {
    // Auto-dismiss after 4 seconds (3s on mobile for faster flow)
    const timer = setTimeout(
      () => {
        onDismiss();
      },
      isMobile ? 3000 : 4000,
    );

    return () => clearTimeout(timer);
  }, [onDismiss, isMobile]);

  if (shouldUseCompact) {
    // Compact corner notification (less intrusive, mobile-friendly)
    return (
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 100, y: 100 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 100 }}
        transition={prefersReducedMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 right-6 z-[100] rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-4 md:p-6 shadow-2xl backdrop-blur-md max-w-[calc(100vw-3rem)] md:max-w-sm"
        onClick={onDismiss}
      >
        {/* Subtle sparkle effect (skip if reduced motion or reduced data) */}
        {!prefersReducedMotion && !prefersReducedData && (
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            {compactParticles.map((particle, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.6, 0],
                  scale: [0, 1.5, 0],
                  x: [0, particle.xOffset],
                  y: [0, particle.yOffset],
                }}
                transition={{
                  duration: 1.5,
                  delay: particle.delay,
                  repeat: 2,
                }}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-yellow-400"
              />
            ))}
          </div>
        )}

        <div className="relative flex items-center gap-3 md:gap-4">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -90 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
            transition={prefersReducedMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 400, damping: 15 }}
            className="shrink-0"
          >
            <div className="rounded-full bg-yellow-500/20 p-2 md:p-3 border-2 border-yellow-500">
              <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-yellow-500" />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.h3
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
              className="text-lg md:text-xl font-bold text-foreground mb-1"
            >
              {t('levelUpTitle')}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
              className="text-base md:text-lg text-yellow-500 font-semibold"
            >
              {t('reachedLevel', { level: newLevel })}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.4 }}
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
          {fullscreenParticles.map((particle, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                x: particle.xOffset,
                y: particle.yOffset,
              }}
              transition={{
                duration: 2,
                delay: particle.delay,
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
