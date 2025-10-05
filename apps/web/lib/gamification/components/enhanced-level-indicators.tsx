/**
 * Enhanced Level Progress Components
 *
 * Features:
 * - Animated gradient borders
 * - Milestone markers
 * - Particle effects for level-ups
 * - Smooth transitions
 */

'use client';

import type { UserGamificationProfile } from '@/types/gamification';
import { motion, useAnimationControls } from 'framer-motion';
import { animations } from '../design-tokens';
import { Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLevelInfo } from '../levels';
import { cn } from '@/lib/utils';

// ============================================================================
// Enhanced Level Progress Bar
// ============================================================================

interface EnhancedLevelProgressProps {
  profile: UserGamificationProfile;
  showMilestones?: boolean;
  animated?: boolean;
  className?: string;
}

export function EnhancedLevelProgress({
  profile,
  showMilestones = true,
  animated = true,
  className,
}: EnhancedLevelProgressProps) {
  const [previousLevel, setPreviousLevel] = useState(profile.level);
  const controls = useAnimationControls();

  // Calculate progress
  const currentLevelXP = profile.xp_in_current_level || 0;
  const nextLevelXP = profile.xp_to_next_level || 100;
  const progress = (currentLevelXP / nextLevelXP) * 100;

  // Define milestones (25%, 50%, 75%)
  const milestones = [25, 50, 75];

  // Detect level up
  useEffect(() => {
    if (profile.level > previousLevel && animated) {
      // Trigger celebration animation
      controls.start({
        scale: [1, 1.05, 1],
        transition: { duration: 0.5, times: [0, 0.5, 1] },
      });
    }
    setPreviousLevel(profile.level);
  }, [profile.level, previousLevel, controls, animated]);

  return (
    <motion.div
      animate={controls}
      className={cn('space-y-2', className)}
    >
      {/* Progress bar with gradient border */}
      <div className="relative">
        {/* Gradient border effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-sm" />

        {/* Progress bar container */}
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          {/* Animated progress fill with gradient */}
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{
              duration: animated ? animations.duration.slow / 1000 : 0,
              ease: 'easeOut',
            }}
          >
            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
            />
          </motion.div>

          {/* Milestone markers */}
          {showMilestones &&
            milestones.map((milestone) => (
              <div
                key={milestone}
                className="absolute top-0 h-full w-0.5 bg-background"
                style={{ left: `${milestone}%` }}
              >
                {progress >= milestone && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 left-1/2 -translate-x-1/2"
                  >
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </motion.div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* XP Labels */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium tabular-nums">{currentLevelXP.toLocaleString()} XP</span>
        <span className="tabular-nums">{nextLevelXP.toLocaleString()} XP</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Particle Effect Component
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
}

interface ParticleEffectProps {
  trigger: boolean;
  particleCount?: number;
  colors?: string[];
  duration?: number;
  onComplete?: () => void;
}

export function ParticleEffect({
  trigger,
  particleCount = 20,
  colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'],
  duration = 1500,
  onComplete,
}: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    // Generate particles
    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => {
      const colorIndex = Math.floor(Math.random() * colors.length);
      return {
        id: i,
        x: Math.random() * 100 - 50, // -50 to 50
        y: -Math.random() * 100, // 0 to -100 (upward)
        size: Math.random() * 6 + 2, // 2-8px
        color: colors[colorIndex] ?? '#3b82f6',
        duration: Math.random() * 500 + duration, // Varied duration
      };
    });

    setParticles(newParticles);

    // Clear particles after animation
    const timeout = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, duration + 500);

    return () => clearTimeout(timeout);
  }, [trigger, particleCount, colors, duration, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
          }}
          initial={{
            x: 0,
            y: 0,
            opacity: 1,
            scale: 0,
          }}
          animate={{
            x: particle.x,
            y: particle.y,
            opacity: [1, 1, 0],
            scale: [0, 1, 0.5],
          }}
          transition={{
            duration: particle.duration / 1000,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Level Badge with Glow Effect
// ============================================================================

interface GlowingLevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export function GlowingLevelBadge({ level, size = 'md', animated = true, className }: GlowingLevelBadgeProps) {
  // getLevelInfo requires a translation function, so we'll use a minimal implementation
  const levelInfo = getLevelInfo(level, (key: string) => key);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <motion.div
      className={cn('relative inline-flex items-center justify-center', className)}
      whileHover={animated ? { scale: 1.05 } : undefined}
    >
      {/* Glow effect */}
      {animated && (
        <motion.div
          className={cn(
            'absolute inset-0 rounded-full bg-gradient-to-r opacity-50 blur-md',
            levelInfo.color.replace('text-', 'from-'),
          )}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Badge */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full border-2 border-border bg-background shadow-lg',
          sizeClasses[size],
        )}
      >
        <div className={cn('flex flex-col items-center gap-0.5')}>
          <levelInfo.icon className={cn(iconSizes[size], levelInfo.color)} />
          <span className={cn('font-bold tabular-nums', levelInfo.color)}>{level}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// XP Gain Animation (Mini Celebration)
// ============================================================================

interface XPGainAnimationProps {
  amount: number;
  trigger: boolean;
  position?: { x: number; y: number };
  onComplete?: () => void;
}

export function XPGainAnimation({ amount, trigger, position, onComplete }: XPGainAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsVisible(true);
      const timeout = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [trigger, onComplete]);

  if (!isVisible) return null;

  return (
    <motion.div
      className="pointer-events-none fixed z-50"
      style={{
        left: position?.x ?? '50%',
        top: position?.y ?? '50%',
      }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: -50, scale: [0.5, 1.2, 1] }}
      transition={{ duration: 1.5, times: [0, 0.2, 0.8, 1] }}
    >
      <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
        <Sparkles className="h-4 w-4" />+{amount} XP
      </div>
    </motion.div>
  );
}

// ============================================================================
// Milestone Progress Indicator
// ============================================================================

interface MilestoneProgressProps {
  currentLevel: number;
  milestones?: number[];
  className?: string;
}

export function MilestoneProgress({ currentLevel, milestones = [5, 10, 25, 50], className }: MilestoneProgressProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {milestones.map((milestone, index) => {
        const isReached = currentLevel >= milestone;
        const isNext = !isReached && (index === 0 || currentLevel >= (milestones[index - 1] ?? 0));

        return (
          <div
            key={milestone}
            className="flex flex-col items-center gap-1"
          >
            <motion.div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold',
                isReached && 'border-primary bg-primary text-primary-foreground',
                isNext && 'border-primary bg-primary/10 text-primary',
                !isReached && !isNext && 'border-muted bg-muted text-muted-foreground',
              )}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              {isReached ? <Star className="h-5 w-5 fill-current" /> : milestone}
            </motion.div>
            <span className="text-xs text-muted-foreground">Level {milestone}</span>
            {index < milestones.length - 1 && (
              <div className={cn('h-0.5 w-8', isReached ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
