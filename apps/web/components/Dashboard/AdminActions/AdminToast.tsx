'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Toast Types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
  // Convenience methods
  success: (title: string, description?: string, options?: Partial<Toast>) => string;
  error: (title: string, description?: string, options?: Partial<Toast>) => string;
  warning: (title: string, description?: string, options?: Partial<Toast>) => string;
  info: (title: string, description?: string, options?: Partial<Toast>) => string;
  loading: (title: string, description?: string, options?: Partial<Toast>) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast Provider
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast if duration is set and it's not a loading toast
    if (newToast.duration && newToast.type !== 'loading') {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(toast =>
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'success', title, description, ...options });
  }, [addToast]);

  const error = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'error', title, description, duration: 7000, ...options });
  }, [addToast]);

  const warning = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'warning', title, description, ...options });
  }, [addToast]);

  const info = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'info', title, description, ...options });
  }, [addToast]);

  const loading = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'loading', title, description, duration: 0, dismissible: false, ...options });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      updateToast,
      clearAll,
      success,
      error,
      warning,
      info,
      loading
    }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

// Hook to use toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Individual Toast Component
const ToastItem = ({ toast }: { toast: Toast }) => {
  const { removeToast } = useToast();

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getBackgroundClass = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'loading':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTitleClass = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-yellow-900';
      case 'info':
        return 'text-blue-900';
      case 'loading':
        return 'text-blue-900';
      default:
        return 'text-gray-900';
    }
  };

  const getDescriptionClass = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      case 'info':
        return 'text-blue-700';
      case 'loading':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'relative max-w-sm w-full rounded-lg border p-4 shadow-lg',
        getBackgroundClass()
      )}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        <div className="ml-3 w-0 flex-1">
          <p className={cn('text-sm font-medium', getTitleClass())}>
            {toast.title}
          </p>

          {toast.description && (
            <p className={cn('mt-1 text-sm', getDescriptionClass())}>
              {toast.description}
            </p>
          )}

          {toast.action && (
            <div className="mt-3">
              <button
                onClick={toast.action.onClick}
                className={cn(
                  'text-sm font-medium underline hover:no-underline focus:outline-none',
                  toast.type === 'success' ? 'text-green-700 hover:text-green-800' :
                  toast.type === 'error' ? 'text-red-700 hover:text-red-800' :
                  toast.type === 'warning' ? 'text-yellow-700 hover:text-yellow-800' :
                  'text-blue-700 hover:text-blue-800'
                )}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {toast.dismissible && (
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => removeToast(toast.id)}
              className={cn(
                'rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2',
                toast.type === 'success' ? 'focus:ring-green-500' :
                toast.type === 'error' ? 'focus:ring-red-500' :
                toast.type === 'warning' ? 'focus:ring-yellow-500' :
                'focus:ring-blue-500'
              )}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar for timed toasts */}
      {toast.duration && toast.duration > 0 && toast.type !== 'loading' && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-current opacity-20 rounded-bl-lg"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{
            duration: toast.duration / 1000,
            ease: 'linear'
          }}
        />
      )}
    </motion.div>
  );
};

// Toast Container
const ToastContainer = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Admin-specific toast hooks
export const useAdminToast = () => {
  const toast = useToast();

  const adminSuccess = useCallback((message: string, description?: string) => {
    return toast.success(
      `Admin: ${message}`,
      description,
      { duration: 4000 }
    );
  }, [toast]);

  const adminError = useCallback((message: string, description?: string) => {
    return toast.error(
      `Admin Error: ${message}`,
      description,
      {
        duration: 8000,
        action: {
          label: 'Report Issue',
          onClick: () => {
            // Handle error reporting
            console.log('Report issue clicked');
          }
        }
      }
    );
  }, [toast]);

  const adminOperation = useCallback((operation: string) => {
    const loadingId = toast.loading(
      `Processing: ${operation}`,
      'Please wait while we complete this operation...'
    );

    return {
      success: (message?: string) => {
        toast.updateToast(loadingId, {
          type: 'success',
          title: `Completed: ${operation}`,
          description: message || 'Operation completed successfully',
          duration: 4000,
          dismissible: true
        });
      },
      error: (error?: string) => {
        toast.updateToast(loadingId, {
          type: 'error',
          title: `Failed: ${operation}`,
          description: error || 'Operation failed. Please try again.',
          duration: 6000,
          dismissible: true,
          action: {
            label: 'Retry',
            onClick: () => {
              // Handle retry logic
              console.log('Retry clicked');
            }
          }
        });
      },
      dismiss: () => {
        toast.removeToast(loadingId);
      }
    };
  }, [toast]);

  const bulkOperation = useCallback((
    totalItems: number,
    operation: string,
    onProgress?: (processed: number) => void
  ) => {
    const loadingId = toast.loading(
      `Bulk ${operation}`,
      `Processing 0 of ${totalItems} items...`
    );

    return {
      updateProgress: (processed: number) => {
        toast.updateToast(loadingId, {
          description: `Processing ${processed} of ${totalItems} items...`
        });
        onProgress?.(processed);
      },
      complete: (successful: number, failed: number = 0) => {
        toast.updateToast(loadingId, {
          type: failed > 0 ? 'warning' : 'success',
          title: `Bulk ${operation} Complete`,
          description: failed > 0
            ? `${successful} successful, ${failed} failed`
            : `All ${successful} items processed successfully`,
          duration: 5000,
          dismissible: true
        });
      },
      error: (error: string) => {
        toast.updateToast(loadingId, {
          type: 'error',
          title: `Bulk ${operation} Failed`,
          description: error,
          duration: 6000,
          dismissible: true
        });
      }
    };
  }, [toast]);

  return {
    ...toast,
    adminSuccess,
    adminError,
    adminOperation,
    bulkOperation
  };
};

export default {
  ToastProvider,
  useToast,
  useAdminToast
};
