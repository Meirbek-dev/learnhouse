'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { isValidElement, useCallback, useState } from 'react';

/**
 * Props for the ConfirmationModal component
 */
interface ModalParams {
  /** The message displayed in the modal body */
  confirmationMessage: string;
  /** Text for the confirm/action button */
  confirmationButtonText: string;
  /** Title displayed in the modal header */
  dialogTitle: string;
  /** Function to execute when the confirmation button is clicked */
  functionToExecute: () => void | Promise<void>;
  /** ReactNode that triggers the modal when clicked */
  dialogTrigger?: ReactNode;
  /** Visual style of the modal - 'warning' for destructive actions, 'info' for general confirmations */
  status?: 'warning' | 'info';
  /** Optional ID for the confirmation button */
  buttonid?: string;
  /** Text for the cancel button */
  cancelButtonText?: string;
  /** Whether to show the cancel button (default: true) */
  showCancelButton?: boolean;
  /** Size of the modal dialog */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the confirmation button is disabled */
  disabled?: boolean;
}

const ConfirmationModal = (params: ModalParams) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const t = useTranslations('Components.ConfirmationModal')

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!isExecuting) {
        setIsDialogOpen(open);
      }
    },
    [isExecuting],
  );

  // Helper: wrap button in span if needed for proper DialogTrigger usage
  const getSafeDialogTrigger = useCallback((trigger: ReactNode) => {
    if (!trigger) return null;
    if (isValidElement(trigger)) {
      const type = (trigger.type as any)?.toString?.() || '';
      // If already span/div, return as is
      if (type.includes('span') || type.includes('div')) return trigger;
      // If button, wrap in span
      if (type.includes('button')) return <span>{trigger}</span>;
    }
    return trigger;
  }, []);

  const getStatusConfig = useCallback(() => {
    const isWarning = params.status === 'warning';
    return {
      iconBg: isWarning
        ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
        : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400',
      buttonVariant: isWarning ? 'destructive' : 'default',
      icon: isWarning ? AlertTriangle : Info,
    };
  }, [params.status]);

  const getSizeConfig = useCallback(() => {
    switch (params.size) {
      case 'sm':
        return 'sm:max-w-sm';
      case 'lg':
        return 'sm:max-w-lg';
      default:
        return 'sm:max-w-md';
    }
  }, [params.size]);

  const handleExecute = useCallback(async () => {
    if (params.disabled || isExecuting) return;

    setIsExecuting(true);
    try {
      await params.functionToExecute();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error executing confirmation action:', error);
      // Keep modal open on error so user can retry
    } finally {
      setIsExecuting(false);
    }
  }, [params.disabled, params.functionToExecute, isExecuting]);

  const statusConfig = getStatusConfig();
  const sizeConfig = getSizeConfig();
  const Icon = statusConfig.icon;

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={onOpenChange}
    >
      {params.dialogTrigger && <DialogTrigger asChild>{getSafeDialogTrigger(params.dialogTrigger)}</DialogTrigger>}
      <DialogContent
        className={cn(sizeConfig)}
        aria-describedby="confirmation-description"
      >
        <DialogHeader className="pb-0">
          <div className="flex gap-4 items-start">
            <div
              className={cn(
                'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                statusConfig.iconBg,
              )}
              aria-hidden="true"
            >
              <Icon className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground mb-2 text-left">
                {params.dialogTitle}
              </DialogTitle>
              <DialogDescription
                id="confirmation-description"
                className="text-sm text-muted-foreground leading-relaxed text-left"
              >
                {params.confirmationMessage}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="pt-6 flex-col-reverse sm:flex-row gap-2">
          {params.showCancelButton !== false && (
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto"
              disabled={isExecuting}
              type="button"
            >
              {params.cancelButtonText || t('cancel')}
            </Button>
          )}
          <Button
            id={params.buttonid}
            variant={statusConfig.buttonVariant as any}
            onClick={handleExecute}
            className="w-full sm:w-auto"
            disabled={params.disabled || isExecuting}
            type="button"
            aria-describedby="confirmation-description"
          >
            {isExecuting ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span className="sr-only">{t('loading')}</span>
                {t('loading')}
              </div>
            ) : (
              params.confirmationButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;
