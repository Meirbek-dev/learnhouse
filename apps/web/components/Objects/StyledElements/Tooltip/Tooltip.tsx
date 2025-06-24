'use client';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { styled, keyframes } from '@stitches/react';
import type { ReactNode } from 'react';

interface TooltipProps {
  sideOffset?: number;
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left'; // default is bottom
  slateBlack?: boolean;
  unstyled?: boolean; // new prop to remove default styling
}

const ToolTip = ({ sideOffset, content, children, side = 'bottom', slateBlack, unstyled }: TooltipProps) => (
  <TooltipPrimitive.Provider delayDuration={200}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipContent
          slateBlack={slateBlack}
          unstyled={unstyled}
          side={side}
          sideOffset={sideOffset}
        >
          {content}
        </TooltipContent>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);

const slideUpAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateY(2px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const slideRightAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateX(-2px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

const slideDownAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-2px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const slideLeftAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateX(2px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

const closeAndFade = keyframes({
  '0%': { opacity: 1 },
  '100%': { opacity: 0 },
});

const TooltipContent = styled(TooltipPrimitive.Content, {
  'variants': {
    slateBlack: {
      true: {
        backgroundColor: ' #0d0d0d',
        color: 'white',
      },
    },
    unstyled: {
      true: {
        padding: 0,
        backgroundColor: 'transparent',
        boxShadow: 'none',
        borderRadius: 0,
        fontSize: 'inherit',
        lineHeight: 'inherit',
        color: 'inherit',
      },
    },
  },

  'borderRadius': 4,
  'padding': '5px 10px',
  'fontSize': 12,
  'lineHeight': 1,
  'color': 'black',
  'backgroundColor': 'rgba(217, 217, 217, 0.50)',
  'zIndex': 500,
  'boxShadow': 'hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px',
  'userSelect': 'none',
  'animationDuration': '400ms',
  'animationTimingFunction': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'willChange': 'transform, opacity',
  '&[data-state="delayed-open"]': {
    '&[data-side="top"]': { animationName: slideDownAndFade },
    '&[data-side="right"]': { animationName: slideLeftAndFade },
    '&[data-side="bottom"]': { animationName: slideUpAndFade },
    '&[data-side="left"]': { animationName: slideRightAndFade },
  },

  // closing animation
  '&[data-state="closed"]': {
    '&[data-side="top"]': { animationName: closeAndFade },
    '&[data-side="right"]': { animationName: closeAndFade },
    '&[data-side="bottom"]': { animationName: closeAndFade },
    '&[data-side="left"]': { animationName: closeAndFade },
  },
});

export default ToolTip;
