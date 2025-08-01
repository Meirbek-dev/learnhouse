'use client';

import { Award, Star, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import React from 'react';

interface XPGainToastProps {
  /** Amount of XP gained */
  xpAmount: number;
  /** Source of the XP gain */
  source: string;
  /** Display name for the source */
  sourceDisplayName?: string;
  /** Additional context about the gain */
  context?: Record<string, any>;
  /** Optional translations for localization */
  translations?: {
    xpText?: string;
    streakText?: string;
  };
}

/**
 * Shows an animated XP gain toast notification
 */
export function showXPGainToast({ xpAmount, source, sourceDisplayName, context, translations }: XPGainToastProps) {
  const displayName = sourceDisplayName || source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  // Choose icon based on source
  const getIcon = () => {
    if (source.includes('streak')) return Zap;
    if (source.includes('completion')) return Award;
    return Star;
  };

  const Icon = getIcon();

  // Color scheme based on XP amount
  const getColorScheme = () => {
    if (xpAmount >= 100) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    if (xpAmount >= 50) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
    return 'text-green-600 bg-green-100 dark:bg-green-900/20';
  };

  const colorScheme = getColorScheme();

  toast.custom(
    (t) => (
      <motion.div
        initial={{ opacity: 0, x: 100, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'pointer-events-auto flex w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800',
          t.visible ? 'animate-enter' : 'animate-leave',
        )}
      >
        <div className="flex w-full items-center p-4">
          <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', colorScheme)}>
            <Icon className="h-5 w-5" />
          </div>

          <div className="ml-3 flex-1">
            <div className="flex items-center gap-2">
              <motion.span
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-lg font-bold text-green-600 dark:text-green-400"
              >
                +{xpAmount} XP
              </motion.span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{displayName}</p>
            {context?.streak_count && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {translations?.streakText || `${context.streak_count} day streak! 🔥`}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    ),
    {
      duration: 4000,
    },
  );
}

/**
 * Shows a streak bonus toast notification
 */
export function showStreakBonusToast(
  streakDays: number,
  bonusXP: number,
  translations?: {
    streakBonus: string;
    streakDays: string;
  },
) {
  const streakBonusText = translations?.streakBonus || 'Streak Bonus!';
  const streakDaysText = translations?.streakDays || `for ${streakDays} days!`;

  toast.custom(
    (t) => (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -50 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'pointer-events-auto flex w-full max-w-md rounded-lg border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-red-50 shadow-lg dark:from-orange-950/20 dark:to-red-950/20',
          t.visible ? 'animate-enter' : 'animate-leave',
        )}
      >
        <div className="flex w-full items-center p-4">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, 10, -10, 5, 0] }}
            transition={{ duration: 0.6 }}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800"
          >
            <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </motion.div>

          <div className="ml-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-orange-800 dark:text-orange-200">{streakBonusText}</span>
              <span className="text-2xl">🔥</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.span
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-lg font-bold text-orange-600 dark:text-orange-400"
              >
                +{bonusXP} XP
              </motion.span>
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{streakDaysText}</span>
            </div>
          </div>
        </div>
      </motion.div>
    ),
    {
      duration: 5000,
    },
  );
}

export default showXPGainToast;
