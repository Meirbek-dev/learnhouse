'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  const t = useTranslations('Pagination');
  return (
    <nav
      aria-label={t('label')}
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('gap-1 flex items-center', className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="pagination-item"
      {...props}
    />
  );
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>;

function PaginationLink({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? 'outline' : 'ghost'}
      size={size}
      className={cn(className)}
      nativeButton={false}
      render={
        <a
          aria-current={isActive ? 'page' : undefined}
          data-slot="pagination-link"
          data-active={isActive}
          {...props}
        />
      }
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  const t = useTranslations('Pagination');
  return (
    <PaginationLink
      aria-label={t('previousAria')}
      size="default"
      className={cn('pl-2!', className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{t('previous')}</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  const t = useTranslations('Pagination');
  return (
    <PaginationLink
      aria-label={t('nextAria')}
      size="default"
      className={cn('pr-2!', className)}
      {...props}
    >
      <span className="hidden sm:block">{t('next')}</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  const t = useTranslations('Pagination');
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("size-9 [&_svg:not([class*='size-'])]:size-4 flex items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">{t('ellipsisAria')}</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
