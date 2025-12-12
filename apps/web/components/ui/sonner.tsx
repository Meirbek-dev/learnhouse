'use client';

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';

const Toaster = ({ position = 'top-center', ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  const toasterStyle = {
    'zIndex': 999999,
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
    '--border-radius': 'var(--radius)',
  } as React.CSSProperties;

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    setPortalEl(el);
    return () => {
      try {
        document.body.removeChild(el);
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  const content = (
    <Sonner
      position={position}
      theme={theme as ToasterProps['theme']}
      className="toaster group pointer-events-none"
      icons={{
        success: (
          <CircleCheckIcon
            color="green"
            className="size-4"
          />
        ),
        info: (
          <InfoIcon
            color="blue"
            className="size-4"
          />
        ),
        warning: (
          <TriangleAlertIcon
            color="orange"
            className="size-4"
          />
        ),
        error: (
          <OctagonXIcon
            color="red"
            className="size-4"
          />
        ),
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={toasterStyle}
      {...props}
    />
  );

  if (portalEl) {
    return createPortal(content, portalEl);
  }

  return content;
};

export { Toaster };
