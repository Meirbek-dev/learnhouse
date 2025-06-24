'use client';

import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';

import { ButtonBlack } from '../Form/Form';

interface ModalParams {
  dialogTitle?: string;
  dialogDescription?: string;
  dialogContent: ReactNode;
  dialogClose?: ReactNode | null;
  dialogTrigger?: ReactNode;
  addDefCloseButton?: boolean;
  onOpenChange: (open: boolean) => void;
  isDialogOpen?: boolean;
  minHeight?: 'sm' | 'md' | 'lg' | 'xl' | 'no-min';
  minWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'no-min';
  customHeight?: string;
  customWidth?: string;
}

const Modal = (params: ModalParams) => {
  const t = useTranslations('Components.Modal');

  const getMinHeight = () => {
    switch (params.minHeight) {
      case 'sm':
        return 'md:min-h-[300px]';
      case 'md':
        return 'md:min-h-[500px]';
      case 'lg':
        return 'md:min-h-[700px]';
      case 'xl':
        return 'md:min-h-[900px]';
      default:
        return '';
    }
  };

  const getMinWidth = () => {
    switch (params.minWidth) {
      case 'sm':
        return 'md:min-w-[600px]';
      case 'md':
        return 'md:min-w-[800px]';
      case 'lg':
        return 'md:min-w-[1000px]';
      case 'xl':
        return 'md:min-w-[1200px]';
      default:
        return '';
    }
  };

  return (
    <Dialog
      open={params.isDialogOpen ?? false}
      onOpenChange={params.onOpenChange}
    >
      {params.dialogTrigger && <DialogTrigger asChild>{params.dialogTrigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          'overflow-auto',
          'w-[95vw] max-w-[95vw]',
          'max-h-[90vh]',
          'p-4',
          // Tablet and up
          'md:w-auto md:max-w-[90vw] md:p-6',
          getMinHeight(),
          getMinWidth(),
          params.customHeight,
          params.customWidth,
        )}
      >
        <DialogHeader className="flex w-full flex-col space-y-0.5 text-center">
          {params.dialogTitle ? (
            <DialogTitle>{params.dialogTitle}</DialogTitle>
          ) : (
            <VisuallyHidden.Root>
              <DialogTitle>{t('dialog')}</DialogTitle>
            </VisuallyHidden.Root>
          )}
          {params.dialogDescription && <DialogDescription>{params.dialogDescription}</DialogDescription>}
        </DialogHeader>
        <div>{params.dialogContent}</div>
        {(params.dialogClose || params.addDefCloseButton) && (
          <DialogFooter>
            {params.dialogClose}
            {params.addDefCloseButton && <ButtonBlack type="submit">{t('closeButtonDefault')}</ButtonBlack>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
