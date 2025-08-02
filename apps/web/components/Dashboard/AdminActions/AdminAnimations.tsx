'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Animation Variants
export const adminAnimations = {
  // Page transitions
  pageEnter: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },

  // Slide transitions for tabs
  slideIn: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
    transition: { duration: 0.25, ease: 'easeInOut' }
  },

  // Stagger animations for lists
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  },

  staggerItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  },

  // Scale animations for cards
  scaleOnHover: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  },

  // Pulse animation for loading states
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  },

  // Fade in/out
  fadeInOut: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },

  // Bounce animation for success states
  bounce: {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 0.6,
        ease: 'easeOut'
      }
    }
  },

  // Shake animation for errors
  shake: {
    animate: {
      x: [0, -10, 10, -10, 10, 0],
      transition: {
        duration: 0.5,
        ease: 'easeInOut'
      }
    }
  }
};

// Enhanced Motion Components

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export const AnimatedCard = ({ children, className, delay = 0, hover = true }: AnimatedCardProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      whileHover={hover && !prefersReducedMotion ? { y: -2 } : undefined}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedListProps {
  children: ReactNode[];
  className?: string;
}

export const AnimatedList = ({ children, className }: AnimatedListProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={prefersReducedMotion ? undefined : adminAnimations.staggerContainer}
      initial="initial"
      animate="animate"
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={prefersReducedMotion ? undefined : adminAnimations.staggerItem}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

interface AnimatedTabContentProps {
  children: ReactNode;
  isActive: boolean;
  className?: string;
}

export const AnimatedTabContent = ({ children, isActive, className }: AnimatedTabContentProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          className={className}
          initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Enhanced Button with micro-interactions
interface AnimatedButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'error' | 'loading';
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedButton = ({
  children,
  className,
  onClick,
  disabled = false,
  variant = 'default',
  size = 'md'
}: AnimatedButtonProps) => {
  const [isClicked, setIsClicked] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleClick = () => {
    if (!disabled) {
      setIsClicked(true);
      onClick?.();
      setTimeout(() => setIsClicked(false), 150);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    error: 'bg-red-600 text-white hover:bg-red-700',
    loading: 'bg-gray-400 text-white cursor-not-allowed'
  };

  return (
    <motion.button
      className={cn(
        'rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        sizeClasses[size],
        variantClasses[variant],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={handleClick}
      disabled={disabled || variant === 'loading'}
      whileHover={!disabled && !prefersReducedMotion ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !prefersReducedMotion ? { scale: 0.98 } : undefined}
      animate={isClicked && !prefersReducedMotion ? { scale: [1, 0.95, 1] } : undefined}
      transition={{ duration: 0.15 }}
    >
      {variant === 'loading' ? (
        <div className="flex items-center gap-2">
          <motion.div
            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          Loading...
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
};

// Success/Error Toast Animations
interface AnimatedToastProps {
  children: ReactNode;
  type: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
  onClose?: () => void;
  className?: string;
}

export const AnimatedToast = ({
  children,
  type,
  isVisible,
  onClose,
  className
}: AnimatedToastProps) => {
  const prefersReducedMotion = useReducedMotion();

  const typeClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  };

  useEffect(() => {
    if (isVisible && onClose) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            'fixed top-4 right-4 p-4 border rounded-lg shadow-lg z-50 max-w-sm',
            typeClasses[type],
            className
          )}
          initial={prefersReducedMotion ? false : { opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? false : { opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {children}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Loading State Component
interface AnimatedLoadingProps {
  type?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AnimatedLoading = ({
  type = 'spinner',
  size = 'md',
  className
}: AnimatedLoadingProps) => {
  const prefersReducedMotion = useReducedMotion();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  if (type === 'spinner') {
    return (
      <motion.div
        className={cn(
          'border-2 border-gray-200 border-t-blue-600 rounded-full',
          sizeClasses[size],
          className
        )}
        animate={prefersReducedMotion ? {} : { rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
    );
  }

  if (type === 'dots') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={cn(
              'bg-blue-600 rounded-full',
              size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
            )}
            animate={prefersReducedMotion ? {} : {
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: index * 0.2
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'pulse') {
    return (
      <motion.div
        className={cn(
          'bg-blue-600 rounded-full',
          sizeClasses[size],
          className
        )}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
    );
  }

  return null;
};

// Count-up Animation
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (value: number) => string;
}

export const AnimatedCounter = ({
  value,
  duration = 1,
  className,
  formatter = (v) => v.toString()
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startTime = Date.now();
    const startValue = displayValue;
    const difference = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(startValue + difference * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [value, duration, prefersReducedMotion]);

  return (
    <span className={className}>
      {formatter(displayValue)}
    </span>
  );
};

export default {
  adminAnimations,
  AnimatedCard,
  AnimatedList,
  AnimatedTabContent,
  AnimatedButton,
  AnimatedToast,
  AnimatedLoading,
  AnimatedCounter
};
