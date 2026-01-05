'use client';
import { Tooltip, TooltipContent as TooltipContentPrimitive, TooltipTrigger } from '@/components/ui/tooltip';
import React, { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

interface TooltipProps {
  sideOffset?: number;
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  slateBlack?: boolean;
  variant?: 'dark' | 'light';
  unstyled?: boolean;
}

const ToolTip = ({ sideOffset, content, children, side = 'bottom', variant = 'light', unstyled }: TooltipProps) => {
  const singleChild = Children.count(children) === 1 ? (Children.only(children) as React.ReactElement) : null;
  const triggerRender = isValidElement(singleChild) ? cloneElement(singleChild) : <span />;

  // Performance: Pre-compute className once
  const contentClassName = React.useMemo(() => {
    if (unstyled) {
      return 'z-[500] select-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95';
    }

    const variantStyles =
      variant === 'dark' ? 'bg-slate-900 text-white border-slate-800' : 'bg-white/95 text-slate-900 border-slate-200';

    return `z-[500] select-none rounded-lg px-3 py-2 text-sm font-medium leading-none backdrop-blur-sm border shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 ${variantStyles}`;
  }, [unstyled, variant]);

  return (
    <Tooltip>
      {isValidElement(singleChild) ? (
        <TooltipTrigger render={triggerRender} />
      ) : (
        <TooltipTrigger>{children}</TooltipTrigger>
      )}

      <TooltipContentPrimitive
        side={side}
        sideOffset={sideOffset}
        className={`${contentClassName}`}
      >
        {content}
      </TooltipContentPrimitive>
    </Tooltip>
  );
};

export default ToolTip;
