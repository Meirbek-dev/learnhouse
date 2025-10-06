/**
 * Level Progress Components
 *
 * Redesigned for minimalism:
 * - Clean, compact level display
 * - Subtle animations
 * - Focus on current level number
 */

'use client';

import type { UserGamificationProfile } from '@/types/gamification';
import { motion, useAnimationControls } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLevelInfo } from '../levels';
import { cn } from '@/lib/utils';

// ============================================================================
// Compact Level Progress
// ============================================================================

interface LevelProgressProps {
  profile: UserGamificationProfile;
  showMilestones?: boolean;
  animated?: boolean;
  className?: string;
}

export function LevelProgress({ profile, showMilestones = false, animated = true, className }: LevelProgressProps) {
  const [previousLevel, setPreviousLevel] = useState(profile.level);
  const controls = useAnimationControls();

  // Calculate progress
  const currentLevelXP = profile.xp_in_current_level || 0;
  const nextLevelXP = profile.xp_to_next_level || 100;
  const progress = (currentLevelXP / nextLevelXP) * 100;

  // Detect level up
  useEffect(() => {
    if (profile.level > previousLevel && animated) {
      controls.start({
        scale: [1, 1.02, 1],
        transition: { duration: 0.4, times: [0, 0.5, 1] },
      });
    }
    setPreviousLevel(profile.level);
  }, [profile.level, previousLevel, controls, animated]);

  return (
    <motion.div
      animate={controls}
      className={cn('space-y-1.5', className)}
    >
      {/* Compact progress bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/50">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{
            duration: animated ? 0.6 : 0,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </div>

      {/* Minimal XP display */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
        <span className="tabular-nums">{currentLevelXP.toLocaleString()}</span>
        <span className="tabular-nums">{nextLevelXP.toLocaleString()} XP</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Subtle Particle Effect
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
  particleCount = 12,
  colors = ['#3b82f6', '#8b5cf6', '#ec4899'],
  duration = 1000,
  onComplete,
}: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => {
      const colorIndex = Math.floor(Math.random() * colors.length);
      return {
        id: i,
        x: Math.random() * 80 - 40,
        y: -Math.random() * 60 - 20,
        size: Math.random() * 4 + 2,
        color: colors[colorIndex] ?? '#3b82f6',
        duration: Math.random() * 300 + duration,
      };
    });

    setParticles(newParticles);

    const timeout = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, duration + 400);

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
            opacity: 0.8,
            scale: 0,
          }}
          animate={{
            x: particle.x,
            y: particle.y,
            opacity: [0.8, 0.6, 0],
            scale: [0, 1, 0.3],
          }}
          transition={{
            duration: particle.duration / 1000,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Compact Level Badge (Redesigned)
// ============================================================================

interface GlowingLevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export function GlowingLevelBadge({ level, size = 'md', animated = true, className }: GlowingLevelBadgeProps) {
  const levelInfo = getLevelInfo(level, (key: string) => key);

  const sizeClasses = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  return (
    <motion.div
      className={cn('relative inline-flex items-center justify-center', className)}
      whileHover={animated ? { scale: 1.08 } : undefined}
      transition={{ duration: 0.2 }}
    >
      {/* Subtle background glow */}
      <div
        className={cn('absolute inset-0 rounded-full opacity-20 blur-sm', levelInfo.color.replace('text-', 'bg-'))}
      />

      {/* Clean badge */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full border border-border/50 bg-background/95 backdrop-blur-sm shadow-sm',
          sizeClasses[size],
        )}
      >
        <span className={cn('font-semibold tabular-nums', levelInfo.color)}>{level}</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Compact XP Gain Animation
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
      }, 1200);
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
      initial={{ opacity: 0, y: 0, scale: 0.8 }}
      animate={{ opacity: [0, 1, 1, 0], y: -40, scale: [0.8, 1, 1] }}
      transition={{ duration: 1.2, times: [0, 0.2, 0.8, 1], ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-primary shadow-lg">
        <Sparkles className="h-3 w-3" />+{amount} XP
      </div>
    </motion.div>
  );
}

// ============================================================================
// Compact Milestone Progress
// ============================================================================

interface MilestoneProgressProps {
  currentLevel: number;
  milestones?: number[];
  className?: string;
}

export function MilestoneProgress({ currentLevel, milestones = [5, 10, 25, 50], className }: MilestoneProgressProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {milestones.map((milestone, index) => {
        const isReached = currentLevel >= milestone;
        const isNext = !isReached && (index === 0 || currentLevel >= (milestones[index - 1] ?? 0));

        return (
          <>
            <motion.div
              key={milestone}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                isReached && 'border-primary/30 bg-primary text-primary-foreground',
                isNext && 'border-primary bg-primary/5 text-primary',
                !isReached && !isNext && 'border-border/50 bg-muted/30 text-muted-foreground',
              )}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.08, duration: 0.3 }}
              whileHover={{ scale: 1.1 }}
            >
              {isReached ? <Star className="h-3.5 w-3.5 fill-current" /> : milestone}
            </motion.div>
            {index < milestones.length - 1 && (
              <div className={cn('h-px w-3 transition-colors', isReached ? 'bg-primary/40' : 'bg-border/30')} />
            )}
          </>
        );
      })}
    </div>
  );
}
