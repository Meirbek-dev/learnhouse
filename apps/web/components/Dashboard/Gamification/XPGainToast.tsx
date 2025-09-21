'use client';

import { useOptionalXPSourcesContext } from './XPSourcesProvider';
import { Award, Star, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface XPGainToastProps {
  /** Amount of XP gained */
  xpAmount: number;
  /** Source of the XP gain */
  source: string;
  /** Display name for the source */
  sourceDisplayName?: string;
  /** Additional context about the gain */
  context?: Record<string, any>;
}

/**
 * XP Gain Toast Content Component
 */
const XPGainToastContent = ({ xpAmount, source, sourceDisplayName, context }: XPGainToastProps) => {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification.xpGainToast');
  // Access context unconditionally to satisfy React Hooks rules; fall back gracefully if missing.
  const optionalCtx = useOptionalXPSourcesContext();
  // Prefer passed prop, then provider, then translation, raw humanized key
  let displayName = sourceDisplayName;
  if (!displayName) {
    const getLabel = optionalCtx?.getLabel;
    if (getLabel) {
      displayName = getLabel(source);
    }
  }
  if (!displayName) {
    try {
      displayName = t(`sources.${source}` as any);
    } catch {
      displayName = source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  }

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

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'pointer-events-auto flex w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800',
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
              +{xpAmount} {t('xpText')}
            </motion.span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{displayName}</p>
          {context?.streak_count && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('streakText', { count: context.streak_count })}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Shows an animated XP gain toast notification
 */
export function showXPGainToast(props: XPGainToastProps) {
  toast.custom(() => <XPGainToastContent {...props} />, {
    duration: 4000,
  });
}

export default showXPGainToast;
