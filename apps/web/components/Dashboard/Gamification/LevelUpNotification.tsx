'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLevelInfo } from '@/components/Objects/GamificationLevel';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Gift, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface LevelUpNotificationProps {
  /** Whether the notification is visible */
  isVisible: boolean;
  /** The new level reached */
  newLevel: number;
  /** XP gained that caused the level up */
  xpGained: number;
  /** Features unlocked at this level */
  unlockedFeatures?: string[];
  /** Callback when notification is dismissed */
  onDismiss: () => void;
  /** Auto-dismiss after this many milliseconds (default: 8000) */
  autoDismissDelay?: number;
}

export function LevelUpNotification({
  isVisible,
  newLevel,
  xpGained,
  unlockedFeatures = [],
  onDismiss,
  autoDismissDelay = 5000,
}: LevelUpNotificationProps) {
  const tLevel = useTranslations('DashPage.UserAccountSettings.Gamification');
  const t = useTranslations('DashPage.UserAccountSettings.Gamification.levelUpNotification');
  const [showUnlocks, setShowUnlocks] = useState(false);
  const levelInfo = getLevelInfo(newLevel, tLevel);
  const Icon = levelInfo.icon;

  useEffect(() => {
    if (isVisible && autoDismissDelay > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [isVisible, autoDismissDelay, onDismiss]);

  useEffect(() => {
    if (isVisible && unlockedFeatures.length > 0) {
      // Show unlocks after a delay for better UX
      const timer = setTimeout(() => {
        setShowUnlocks(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
    setShowUnlocks(false);
  }, [isVisible, unlockedFeatures.length]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md"
      >
        <Card className="relative overflow-hidden border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-2xl dark:from-yellow-950/20 dark:to-orange-950/20">
          {/* Celebration background effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-100/20 to-transparent" />

          <CardHeader className="relative pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: [0, 10, -10, 10, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="rounded-full bg-yellow-200 p-2 dark:bg-yellow-800"
                >
                  <Icon className={cn('h-8 w-8', levelInfo.color)} />
                </motion.div>
                <div>
                  <CardTitle className="text-xl font-bold text-yellow-800 dark:text-yellow-200">{t('title')}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
                    >
                      {t('levelLabel', { level: newLevel })}
                    </Badge>
                    <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">{levelInfo.title}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8 w-8 p-0 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-900 dark:hover:text-yellow-200"
                title={t('title')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* XP Gained */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2"
            >
              <Star className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('xpEarned', { xp: xpGained })}
              </span>
            </motion.div>

            {/* Level unlocks info */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-yellow-700 dark:text-yellow-300"
            >
              {t('newMastery')}
            </motion.p>

            {/* Unlocked features */}
            <AnimatePresence>
              {showUnlocks && unlockedFeatures.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-yellow-300 bg-yellow-100/50 p-3 dark:border-yellow-700 dark:bg-yellow-900/20">
                    <div className="mb-2 flex items-center gap-2">
                      <Gift className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                        {t('newUnlocks')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {unlockedFeatures.map((feature, index) => (
                        <motion.div
                          key={feature}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * index }}
                          className="flex items-center gap-2"
                        >
                          <Award className="h-3 w-3 text-yellow-600" />
                          <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export default LevelUpNotification;
