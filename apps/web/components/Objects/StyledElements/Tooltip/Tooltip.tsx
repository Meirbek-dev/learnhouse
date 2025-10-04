'use client';
import { Tooltip, TooltipTrigger, TooltipContent as TooltipContentPrimitive } from '@/components/ui/tooltip';
import styled, { css, keyframes } from 'styled-components';
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
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <StyledTooltipContent
      slateBlack={slateBlack}
      unstyled={unstyled}
      side={side}
      sideOffset={sideOffset}
    >
      {content}
    </StyledTooltipContent>
  </Tooltip>
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

interface TooltipContentProps {
  slateBlack?: boolean;
  unstyled?: boolean;
}

const StyledTooltipContent = styled(TooltipContentPrimitive).withConfig({
  shouldForwardProp: (prop) => !['slateBlack', 'unstyled'].includes(prop),
})<TooltipContentProps>`
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  line-height: 1;
  color: black;
  background-color: rgba(217, 217, 217, 0.5);
  z-index: 500;
  box-shadow:
    hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
    hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
  user-select: none;
  animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;

  ${(props) =>
    props.slateBlack &&
    css`
      background-color: #0d0d0d;
      color: white;
    `}

  ${(props) =>
    props.unstyled &&
    css`
      padding: 0;
      background-color: transparent;
      box-shadow: none;
      border-radius: 0;
      font-size: inherit;
      line-height: inherit;
      color: inherit;
    `}

  &[data-state="delayed-open"] {
    &[data-side='top'] {
      animation-name: ${slideDownAndFade};
    }
    &[data-side='right'] {
      animation-name: ${slideLeftAndFade};
    }
    &[data-side='bottom'] {
      animation-name: ${slideUpAndFade};
    }
    &[data-side='left'] {
      animation-name: ${slideRightAndFade};
    }
  }

  &[data-state='closed'] {
    &[data-side='top'] {
      animation-name: ${closeAndFade};
    }
    &[data-side='right'] {
      animation-name: ${closeAndFade};
    }
    &[data-side='bottom'] {
      animation-name: ${closeAndFade};
    }
    &[data-side='left'] {
      animation-name: ${closeAndFade};
    }
  }
`;

export default ToolTip;
