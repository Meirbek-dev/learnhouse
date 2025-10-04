import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Slot as SlotPrimitive } from 'radix-ui';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const Breadcrumb = ({ ...props }: ComponentProps<'nav'>) => {
  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      {...props}
    />
  );
};

const BreadcrumbList = ({ className, ...props }: ComponentProps<'ol'>) => {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words font-medium text-muted-foreground text-sm tracking-tight sm:gap-2.5',
        className,
      )}
      {...props}
    />
  );
};

const BreadcrumbItem = ({ className, ...props }: ComponentProps<'li'>) => {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  );
};

const BreadcrumbLink = ({
  asChild,
  className,
  ...props
}: ComponentProps<'a'> & {
  asChild?: boolean;
}) => {
  const Comp = asChild ? SlotPrimitive.Slot : 'a';

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  );
};

const BreadcrumbPage = ({ className, ...props }: ComponentProps<'span'>) => {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal text-foreground', className)}
      {...props}
    />
  );
};

const BreadcrumbSeparator = ({ children, className, ...props }: ComponentProps<'li'>) => {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
};

const BreadcrumbEllipsis = ({ className, ...props }: ComponentProps<'span'>) => {
  const t = useTranslations('Components.Breadcrumb');

  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">{t('more')}</span>
    </span>
  );
};

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
