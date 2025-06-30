'use client';
import { blackA } from '@radix-ui/colors';
import * as Dialog from '@radix-ui/react-dialog';
import styled, { keyframes } from 'styled-components';
import { AlertTriangle, Info } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { isValidElement, cloneElement } from 'react';

interface ModalParams {
  confirmationMessage: string;
  confirmationButtonText: string;
  dialogTitle: string;
  functionToExecute: any;
  dialogTrigger?: ReactNode;
  status?: 'warning' | 'info';
  buttonid?: string;
}

const ConfirmationModal = (params: ModalParams) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const warningColors = 'bg-red-100 text-red-600';
  const infoColors = 'bg-blue-100 text-blue-600';
  const warningButtonColors = 'text-white bg-red-500 hover:bg-red-600';
  const infoButtonColors = 'text-white bg-blue-500 hover:bg-blue-600';

  const onOpenChange = useCallback((open: boolean) => setIsDialogOpen(open), []);

  // Helper: wrap button in span if needed
  const getSafeDialogTrigger = (trigger: ReactNode) => {
    if (!trigger) return null;
    if (isValidElement(trigger)) {
      const type = (trigger.type as any)?.toString?.() || '';
      // If already span/div, return as is
      if (type.includes('span') || type.includes('div')) return trigger;
      // If button, wrap in span
      if (type.includes('button')) return <span>{trigger}</span>;
    }
    return trigger;
  };

  return (
    <Dialog.Root
      open={isDialogOpen}
      onOpenChange={onOpenChange}
    >
      {params.dialogTrigger ? (
        <Dialog.Trigger asChild>{getSafeDialogTrigger(params.dialogTrigger)}</Dialog.Trigger>
      ) : null}
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent>
          <div className="flex space-x-4 tracking-tight">
            <div
              className={`icon align-content-center flex items-center rounded-xl p-6 ${params.status === 'warning' ? warningColors : infoColors}`}
            >
              {params.status === 'warning' ? <AlertTriangle size={35} /> : <Info size={35} />}
            </div>
            <div className="text w-auto grow space-x-0 pt-1">
              <Dialog.DialogTitle className="text-xl font-bold text-black">{params.dialogTitle}</Dialog.DialogTitle>
              <Dialog.DialogDescription className="text-md mt-1 leading-tight text-gray-500">
                {params.confirmationMessage}
              </Dialog.DialogDescription>
              <div className="mt-4 flex flex-row-reverse">
                <div
                  id={params.buttonid}
                  className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-bold hover:cursor-pointer ${params.status === 'warning' ? warningButtonColors : infoButtonColors} transition duration-300 ease-in-out hover:shadow-lg`}
                  onClick={() => {
                    params.functionToExecute();
                    setIsDialogOpen(false);
                  }}
                >
                  {params.confirmationButtonText}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const overlayShow = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

const overlayClose = keyframes({
  '0%': { opacity: 1 },
  '100%': { opacity: 0 },
});

const contentShow = keyframes({
  '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(.96)' },
  '100%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
});

const contentClose = keyframes({
  '0%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
  '100%': { opacity: 0, transform: 'translate(-50%, -52%) scale(.96)' },
});

const DialogOverlay = styled(Dialog.Overlay)`
  background-color: ${blackA.blackA9};
  position: fixed;
  z-index: 500;
  inset: 0;
  animation: ${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1);

  &[data-state='closed'] {
    animation: ${overlayClose} 150ms cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

const DialogContent = styled(Dialog.Content)`
  background-color: white;
  border-radius: 18px;
  z-index: 501;
  box-shadow:
    hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
    hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: auto;
  min-width: 500px;
  max-width: 600px;
  overflow: visible;
  height: auto;
  max-height: 85vh;
  padding: 24px;
  animation: ${contentShow} 150ms cubic-bezier(0.16, 1, 0.3, 1);
  transition: max-height 0.3s ease-out;

  &:focus {
    outline: none;
  }

  &[data-state='closed'] {
    animation: ${contentClose} 150ms cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

export default ConfirmationModal;
