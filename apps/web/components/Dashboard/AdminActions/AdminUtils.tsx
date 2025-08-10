'use client';

import { useCallback, useMemo } from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslations } from 'next-intl';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format large numbers with K, M, B suffixes
export const formatNumber = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

// Format percentages with proper precision
export const formatPercentage = (value: number, precision = 1): string => {
  return `${value.toFixed(precision)}%`;
};

// Format duration in human-readable format
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const remainingMinutes = Math.floor((seconds % 3600) / 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

// Format dates relative to now - now accepts formatter for localization
export const formatRelativeTime = (date: Date | string, formatter?: any): string => {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;

  // If formatter is available, use it for relative time
  if (formatter) {
    try {
      return formatter.relativeTime(targetDate, now);
    } catch {
      // Fallback to date formatting if relative time fails
      try {
        return formatter.dateTime(targetDate, {
          dateStyle: 'short',
        });
      } catch (error) {
        console.warn('Failed to format date with formatter:', error);
      }
    }
  }

  // Fallback to native implementation
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diffInSeconds < 86_400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffInSeconds < 2_592_000) {
    const days = Math.floor(diffInSeconds / 86_400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return targetDate.toLocaleDateString();
};

// Localized relative time formatter hook
export const useLocalizedRelativeTime = () => {
  const t = useTranslations('DashPage.Admin.Utils.relativeTime');

  return useCallback((date: Date | string) => {
    const now = new Date();
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return t('justNow');
    }
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return minutes === 1
        ? t('minuteAgo', { count: minutes })
        : t('minutesAgo', { count: minutes });
    }
    if (diffInSeconds < 86_400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return hours === 1
        ? t('hourAgo', { count: hours })
        : t('hoursAgo', { count: hours });
    }
    if (diffInSeconds < 2_592_000) {
      const days = Math.floor(diffInSeconds / 86_400);
      return days === 1
        ? t('dayAgo', { count: days })
        : t('daysAgo', { count: days });
    }

    return targetDate.toLocaleDateString();
  }, [t]);
};

// Admin color schemes for consistent theming
export const adminColors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    900: '#7f1d1d',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    900: '#111827',
  },
};

// Status badge configurations
export const getStatusConfig = (status: string) => {
  const configs = {
    active: {
      color: adminColors.success[600],
      bg: adminColors.success[50],
      border: adminColors.success[200],
      label: 'Active',
    },
    inactive: {
      color: adminColors.gray[600],
      bg: adminColors.gray[50],
      border: adminColors.gray[200],
      label: 'Inactive',
    },
    pending: {
      color: adminColors.warning[600],
      bg: adminColors.warning[50],
      border: adminColors.warning[200],
      label: 'Pending',
    },
    suspended: {
      color: adminColors.error[600],
      bg: adminColors.error[50],
      border: adminColors.error[200],
      label: 'Suspended',
    },
    completed: {
      color: adminColors.success[600],
      bg: adminColors.success[50],
      border: adminColors.success[200],
      label: 'Completed',
    },
    failed: {
      color: adminColors.error[600],
      bg: adminColors.error[50],
      border: adminColors.error[200],
      label: 'Failed',
    },
    processing: {
      color: adminColors.primary[600],
      bg: adminColors.primary[50],
      border: adminColors.primary[200],
      label: 'Processing',
    },
  };

  return configs[status.toLowerCase()] || configs.inactive;
};

// Localized status config hook
export const useLocalizedStatusConfig = () => {
  const t = useTranslations('DashPage.Admin.Utils.status');

  return useCallback((status: string) => {
    const configs = {
      active: {
        color: adminColors.success[600],
        bg: adminColors.success[50],
        border: adminColors.success[200],
        label: t('active'),
      },
      inactive: {
        color: adminColors.gray[600],
        bg: adminColors.gray[50],
        border: adminColors.gray[200],
        label: t('inactive'),
      },
      pending: {
        color: adminColors.warning[600],
        bg: adminColors.warning[50],
        border: adminColors.warning[200],
        label: t('pending'),
      },
      suspended: {
        color: adminColors.error[600],
        bg: adminColors.error[50],
        border: adminColors.error[200],
        label: t('suspended'),
      },
      completed: {
        color: adminColors.success[600],
        bg: adminColors.success[50],
        border: adminColors.success[200],
        label: t('completed'),
      },
      failed: {
        color: adminColors.error[600],
        bg: adminColors.error[50],
        border: adminColors.error[200],
        label: t('failed'),
      },
      processing: {
        color: adminColors.primary[600],
        bg: adminColors.primary[50],
        border: adminColors.primary[200],
        label: t('processing'),
      },
    };

    return configs[status.toLowerCase()] || configs.inactive;
  }, [t]);
};

// Priority level configurations
export const getPriorityConfig = (priority: string | number) => {
  const level =
    typeof priority === 'string'
      ? priority.toLowerCase()
      : priority > 7
        ? 'critical'
        : priority > 5
          ? 'high'
          : priority > 3
            ? 'medium'
            : 'low';

  const configs = {
    critical: {
      color: adminColors.error[600],
      bg: adminColors.error[50],
      border: adminColors.error[200],
      label: 'Critical',
      icon: '🔴',
    },
    high: {
      color: adminColors.warning[600],
      bg: adminColors.warning[50],
      border: adminColors.warning[200],
      label: 'High',
      icon: '🟡',
    },
    medium: {
      color: adminColors.primary[600],
      bg: adminColors.primary[50],
      border: adminColors.primary[200],
      label: 'Medium',
      icon: '🔵',
    },
    low: {
      color: adminColors.gray[600],
      bg: adminColors.gray[50],
      border: adminColors.gray[200],
      label: 'Low',
      icon: '⚪',
    },
  };

  return configs[level] || configs.low;
};

// Localized priority config hook
export const useLocalizedPriorityConfig = () => {
  const t = useTranslations('DashPage.Admin.Utils.priority');

  return useCallback((priority: string | number) => {
    const level =
      typeof priority === 'string'
        ? priority.toLowerCase()
        : priority > 7
          ? 'critical'
          : priority > 5
            ? 'high'
            : priority > 3
              ? 'medium'
              : 'low';

    const configs = {
      critical: {
        color: adminColors.error[600],
        bg: adminColors.error[50],
        border: adminColors.error[200],
        label: t('critical'),
        icon: '🔴',
      },
      high: {
        color: adminColors.warning[600],
        bg: adminColors.warning[50],
        border: adminColors.warning[200],
        label: t('high'),
        icon: '🟡',
      },
      medium: {
        color: adminColors.primary[600],
        bg: adminColors.primary[50],
        border: adminColors.primary[200],
        label: t('medium'),
        icon: '🔵',
      },
      low: {
        color: adminColors.gray[600],
        bg: adminColors.gray[50],
        border: adminColors.gray[200],
        label: t('low'),
        icon: '⚪',
      },
    };

    return configs[level] || configs.low;
  }, [t]);
};

// Generate chart color palette
export const generateChartColors = (count: number) => {
  const baseColors = [
    adminColors.primary[500],
    adminColors.success[500],
    adminColors.warning[500],
    adminColors.error[500],
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#ec4899', // pink
    '#6366f1', // indigo
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // Generate additional colors if needed
  const colors = [...baseColors];
  while (colors.length < count) {
    const hue = (colors.length * 137.508) % 360; // Golden angle approximation
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }

  return colors;
};

// Data transformation utilities
export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
};

export const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);

  if (Number.isInteger(index)) {
    return sorted[index] ?? 0;
  }

  const lower = sorted[Math.floor(index)] ?? 0;
  const upper = sorted[Math.ceil(index)] ?? 0;
  return lower + (upper - lower) * (index - Math.floor(index));
};

// CSV Export utility
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// Local storage utilities with error handling
export const adminStorage = {
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(`admin_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  },

  get: <T = any,>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(`admin_${key}`);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return defaultValue || null;
    }
  },

  remove: (key: string) => {
    try {
      localStorage.removeItem(`admin_${key}`);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  },

  clear: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('admin_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  },
};

// Debounce utility hook
export const useDebounce = <T extends (...args: any[]) => any>(callback: T, delay: number): T => {
  return useCallback(
    ((...args: Parameters<T>) => {
      const timeoutId = setTimeout(() => callback(...args), delay);
      return () => clearTimeout(timeoutId);
    }) as T,
    [callback, delay],
  );
};

// Memoized calculations
export const useMemoizedStats = (data: number[]) => {
  return useMemo(() => {
    if (data.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        total: 0,
        count: 0,
      };
    }

    const sorted = [...data].sort((a, b) => a - b);
    return {
      average: calculateAverage(data),
      median: calculateMedian(data),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      total: data.reduce((sum, value) => sum + value, 0),
      count: data.length,
    };
  }, [data]);
};

// URL utilities for admin routes
export const adminRoutes = {
  overview: '/admin/dashboard',
  analytics: '/admin/dashboard/analytics',
  system: '/admin/dashboard/system',
  users: '/admin/dashboard/actions',
  courses: '/admin/dashboard/courses',
  reports: '/admin/dashboard/reports',
  settings: '/admin/settings',
};

// Validation utilities
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  phone: (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },

  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  strongPassword: (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  },
};

const AdminUtils = {
  cn,
  formatNumber,
  formatPercentage,
  formatDuration,
  formatRelativeTime,
  useLocalizedRelativeTime,
  adminColors,
  getStatusConfig,
  useLocalizedStatusConfig,
  getPriorityConfig,
  useLocalizedPriorityConfig,
  generateChartColors,
  calculateGrowthRate,
  calculateAverage,
  calculateMedian,
  calculatePercentile,
  exportToCSV,
  adminStorage,
  useDebounce,
  useMemoizedStats,
  adminRoutes,
  validators,
};

export default AdminUtils;
