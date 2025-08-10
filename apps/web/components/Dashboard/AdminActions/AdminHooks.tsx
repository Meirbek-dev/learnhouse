'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminToast } from './AdminToast';
import useSWR, { mutate } from 'swr';

// Enhanced Admin State Hook
export interface AdminState {
  isLoading: boolean;
  error: Error | null;
  data: any;
  retryCount: number;
}

export const useAdminState = <T = any,>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: {
    retryLimit?: number;
    retryDelay?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    enableToast?: boolean;
  },
) => {
  const { adminError, adminSuccess } = useAdminToast();
  const [retryCount, setRetryCount] = useState(0);

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(key, fetcher, {
    onSuccess: (data) => {
      if (options?.enableToast && retryCount > 0) {
        adminSuccess('Data loaded successfully');
      }
      setRetryCount(0);
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      if (options?.enableToast) {
        adminError('Failed to load data', error.message);
      }
      options?.onError?.(error);
    },
    shouldRetryOnError: false,
  });

  const retry = useCallback(async () => {
    const limit = options?.retryLimit || 3;
    const delay = options?.retryDelay || 1000;

    if (retryCount >= limit) {
      adminError('Maximum retry attempts reached', 'Please refresh the page or contact support');
      return;
    }

    setRetryCount((prev) => prev + 1);

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * retryCount));
    }

    refresh();
  }, [retryCount, options, refresh, adminError]);

  const reset = useCallback(() => {
    setRetryCount(0);
    refresh();
  }, [refresh]);

  return {
    data,
    error,
    isLoading,
    retryCount,
    retry,
    reset,
    refresh,
  };
};

// Optimistic Updates Hook
export const useOptimisticAdmin = <T = any,>(
  key: string,
  updateFn: (data: T) => Promise<T>,
  options?: {
    enableToast?: boolean;
    rollbackOnError?: boolean;
  },
) => {
  const { adminSuccess, adminError } = useAdminToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const previousDataRef = useRef<T | null>(null);

  const update = useCallback(
    async (optimisticData: T) => {
      setIsUpdating(true);

      try {
        // Store previous data for potential rollback
        previousDataRef.current = optimisticData;

        // Apply optimistic update
        mutate(key, optimisticData, false);

        // Perform actual update
        const result = await updateFn(optimisticData);

        // Confirm update with real data
        mutate(key, result, false);

        if (options?.enableToast) {
          adminSuccess('Changes saved successfully');
        }

        return result;
      } catch (error) {
        // Rollback on error if enabled
        if (options?.rollbackOnError && previousDataRef.current) {
          mutate(key, previousDataRef.current, false);
        }

        if (options?.enableToast) {
          adminError('Failed to save changes', error instanceof Error ? error.message : 'Unknown error');
        }

        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [key, updateFn, options, adminSuccess, adminError],
  );

  return {
    update,
    isUpdating,
  };
};

// Bulk Operations Hook
export const useBulkAdmin = <T = any,>(
  processFn: (items: T[]) => Promise<{ successful: T[]; failed: { item: T; error: string }[] }>,
  options?: {
    batchSize?: number;
    enableToast?: boolean;
    onProgress?: (processed: number, total: number) => void;
  },
) => {
  const { bulkOperation } = useAdminToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const process = useCallback(
    async (items: T[], operation: string) => {
      if (isProcessing) return;

      setIsProcessing(true);
      setProgress({ processed: 0, total: items.length });

      const batchSize = options?.batchSize || 10;
      const toastHandler = options?.enableToast
        ? bulkOperation(
            items.length,
            operation,
            options?.onProgress ? (processed: number) => options.onProgress?.(processed, items.length) : undefined,
          )
        : null;

      try {
        const allSuccessful: T[] = [];
        const allFailed: { item: T; error: string }[] = [];

        // Process in batches
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);

          try {
            const result = await processFn(batch);
            allSuccessful.push(...result.successful);
            allFailed.push(...result.failed);
          } catch (error) {
            // If batch fails entirely, mark all items as failed
            batch.forEach((item) => {
              allFailed.push({
                item,
                error: error instanceof Error ? error.message : 'Batch processing failed',
              });
            });
          }

          const processed = Math.min(i + batchSize, items.length);
          setProgress({ processed, total: items.length });
          toastHandler?.updateProgress(processed);
          options?.onProgress?.(processed, items.length);
        }

        toastHandler?.complete(allSuccessful.length, allFailed.length);

        return {
          successful: allSuccessful,
          failed: allFailed,
          summary: {
            total: items.length,
            successful: allSuccessful.length,
            failed: allFailed.length,
            successRate: (allSuccessful.length / items.length) * 100,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bulk operation failed';
        toastHandler?.error(errorMessage);
        throw error;
      } finally {
        setIsProcessing(false);
        setProgress({ processed: 0, total: 0 });
      }
    },
    [isProcessing, options, bulkOperation, processFn],
  );

  return {
    process,
    isProcessing,
    progress,
  };
};

// Form State Management Hook
export interface AdminFormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}

export const useAdminForm = <T extends Record<string, any>>(
  initialValues: T,
  validate?: (values: T) => Partial<Record<keyof T, string>>,
  options?: {
    enableToast?: boolean;
    onSubmit?: (values: T) => Promise<void>;
  },
) => {
  const { adminSuccess, adminError } = useAdminToast();
  const [state, setState] = useState<AdminFormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true,
    isDirty: false,
    isSubmitting: false,
  });

  const validateForm = useCallback(
    (values: T) => {
      if (!validate) return {};
      return validate(values);
    },
    [validate],
  );

  const setValue = useCallback(
    (field: keyof T, value: any) => {
      setState((prev) => {
        const newValues = { ...prev.values, [field]: value };
        const errors = validateForm(newValues);

        return {
          ...prev,
          values: newValues,
          errors,
          touched: { ...prev.touched, [field]: true },
          isValid: Object.keys(errors).length === 0,
          isDirty: true,
        };
      });
    },
    [validateForm],
  );

  const setValues = useCallback(
    (values: Partial<T>) => {
      setState((prev) => {
        const newValues = { ...prev.values, ...values };
        const errors = validateForm(newValues);

        return {
          ...prev,
          values: newValues,
          errors,
          isValid: Object.keys(errors).length === 0,
          isDirty: true,
        };
      });
    },
    [validateForm],
  );

  const setError = useCallback((field: keyof T, error: string) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: error },
      isValid: false,
    }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setState((prev) => {
      const newErrors = { ...prev.errors };
      delete newErrors[field];

      return {
        ...prev,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
      };
    });
  }, []);

  const submit = useCallback(async () => {
    if (!options?.onSubmit) return;

    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const errors = validateForm(state.values);

      if (Object.keys(errors).length > 0) {
        setState((prev) => ({ ...prev, errors, isValid: false, isSubmitting: false }));
        return;
      }

      await options.onSubmit(state.values);

      if (options.enableToast) {
        adminSuccess('Form submitted successfully');
      }

      setState((prev) => ({ ...prev, isDirty: false, isSubmitting: false }));
    } catch (error) {
      if (options.enableToast) {
        adminError('Form submission failed', error instanceof Error ? error.message : 'Unknown error');
      }

      setState((prev) => ({ ...prev, isSubmitting: false }));
      throw error;
    }
  }, [state.values, options, validateForm, adminSuccess, adminError]);

  const reset = useCallback(() => {
    setState({
      values: initialValues,
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
  }, [initialValues]);

  return {
    ...state,
    setValue,
    setValues,
    setError,
    clearError,
    submit,
    reset,
  };
};

// Permissions Hook
export const useAdminPermissions = (requiredPermissions: string[], userPermissions?: string[]) => {
  // Default to admin permissions if none provided (for development/admin access)
  const [permissions] = useState(userPermissions || ['admin:all']);

  const hasPermission = useCallback(
    (permission: string) => {
      return permissions.includes(permission) || permissions.includes('admin:all');
    },
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (perms: string[]) => {
      return perms.every(hasPermission);
    },
    [hasPermission],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]) => {
      return perms.some(hasPermission);
    },
    [hasPermission],
  );

  const canAccess = hasAllPermissions(requiredPermissions);
  const canPartialAccess = hasAnyPermission(requiredPermissions);

  return {
    permissions,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    canAccess,
    canPartialAccess,
    requiredPermissions,
  };
};

// Debounced Search Hook
export const useAdminSearch = <T = any,>(
  searchFn: (query: string) => Promise<T[]>,
  options?: {
    debounceMs?: number;
    minQueryLength?: number;
    enableToast?: boolean;
  },
) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { adminError } = useAdminToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(
    async (searchQuery: string) => {
      const minLength = options?.minQueryLength || 2;

      if (searchQuery.length < minLength) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const data = await searchFn(searchQuery);
        setResults(data);
      } catch (error) {
        if (options?.enableToast) {
          adminError('Search failed', error instanceof Error ? error.message : 'Unknown error');
        }
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchFn, options, adminError],
  );

  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        search(searchQuery);
      }, options?.debounceMs || 300);
    },
    [search, options],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    query,
    results,
    isSearching,
    search: debouncedSearch,
    clearSearch,
  };
};

const AdminHooks = {
  useAdminState,
  useOptimisticAdmin,
  useBulkAdmin,
  useAdminForm,
  useAdminPermissions,
  useAdminSearch,
};

export default AdminHooks;
