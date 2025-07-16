'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { AlertCircle, Backpack, BadgeDollarSign, BookCopy, Home, LogOut, School, Settings, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

import AdminAuthorization from '@components/Security/AdminAuthorization';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useFeatureFlag from '@components/Hooks/useFeatureFlag';
import { getUriWithoutOrg } from '@services/config/config';
import openuLogoLight from '@public/openu_logo_light.png';
import { useOrg } from '@components/Contexts/OrgContext';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import UserAvatar from '../../Objects/UserAvatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ 'className'?: string; 'aria-hidden'?: boolean }>;
  tooltip: string;
  isActive?: boolean;
  badge?: string | number;
  disabled?: boolean;
}

interface SidebarProps {
  className?: string;
}

// Loading skeleton component
const SidebarSkeleton = memo(() => (
  <Sidebar
    side="left"
    variant="sidebar"
    collapsible="icon"
    className="border-r"
  >
    <SidebarHeader className="border-b border-sidebar-border p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent className="p-4">
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-full rounded-md"
          />
        ))}
      </div>
    </SidebarContent>
    <SidebarFooter className="border-t border-sidebar-border p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </SidebarFooter>
  </Sidebar>
));

SidebarSkeleton.displayName = 'SidebarSkeleton';

// Error fallback component
const SidebarError = memo(({ onRetry }: { onRetry: () => void }) => {
  const t = useTranslations('SidebarMenu');
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{t('errors.failedToLoad')}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
      >
        {t('errors.retry')}
      </Button>
    </div>
  );
});

SidebarError.displayName = 'SidebarError';

// Custom hook for navigation items
const useNavigationItems = () => {
  const pathname = usePathname();
  const t = useTranslations('SidebarMenu');
  const isPaymentsEnabled = useFeatureFlag({
    path: ['features', 'payments', 'enabled'],
    defaultValue: false,
  });

  return useMemo(
    (): NavigationItem[] => [
      {
        title: t('tooltips.home'),
        href: '/dash',
        icon: Home,
        tooltip: t('tooltips.home'),
        isActive: pathname === '/dash',
      },
      {
        title: t('tooltips.courses'),
        href: '/dash/courses',
        icon: BookCopy,
        tooltip: t('tooltips.courses'),
        isActive: pathname.startsWith('/dash/courses'),
      },
      {
        title: t('tooltips.assignments'),
        href: '/dash/assignments',
        icon: Backpack,
        tooltip: t('tooltips.assignments'),
        isActive: pathname.startsWith('/dash/assignments'),
      },
      {
        title: t('tooltips.users'),
        href: '/dash/users/settings/users',
        icon: Users,
        tooltip: t('tooltips.users'),
        isActive: pathname.startsWith('/dash/users'),
      },
      ...(isPaymentsEnabled
        ? [
            {
              title: t('tooltips.payments'),
              href: '/dash/payments/customers',
              icon: BadgeDollarSign,
              tooltip: t('tooltips.payments'),
              isActive: pathname.startsWith('/dash/payments'),
            },
          ]
        : []),
      {
        title: t('tooltips.organization'),
        href: '/dash/org/settings/general',
        icon: School,
        tooltip: t('tooltips.organization'),
        isActive: pathname.startsWith('/dash/org'),
      },
    ],
    [pathname, t, isPaymentsEnabled],
  );
};

// Navigation item component
const NavigationItem = memo(({ item, isCollapsed }: { item: NavigationItem; isCollapsed: boolean }) => (
  <SidebarMenuItem className={isCollapsed ? 'w-full flex justify-center' : ''}>
    <SidebarMenuButton
      asChild
      tooltip={isCollapsed ? item.tooltip : undefined}
      isActive={item.isActive}
      size="default"
      className={`relative group transition-all duration-200 hover:bg-sidebar-accent/50 ${
        isCollapsed ? 'w-10 h-10 p-0 flex items-center justify-center' : 'w-full'
      }`}
      disabled={item.disabled}
    >
      <Link
        href={item.href}
        className={`flex items-center min-w-0 transition-all duration-200 ${
          isCollapsed ? 'justify-center w-full h-full' : 'gap-3 w-full'
        }`}
        aria-label={item.tooltip}
        aria-current={item.isActive ? 'page' : undefined}
      >
        <item.icon
          className="h-4 w-4 shrink-0"
          aria-hidden={true}
        />
        {!isCollapsed && (
          <>
            <span className="truncate font-medium">{item.title}</span>
            {item.badge && (
              <Badge
                variant="secondary"
                className="ml-auto text-xs"
              >
                {item.badge}
              </Badge>
            )}
            {item.isActive && <div className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />}
          </>
        )}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
));

NavigationItem.displayName = 'NavigationItem';

function DashSidebar({ className }: SidebarProps) {
  const org = useOrg() as any;
  const session = useLHSession();
  const { state, toggleSidebar } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const t = useTranslations('SidebarMenu');
  const navigationItems = useNavigationItems();

  const isCollapsed = state === 'collapsed';
  const isExpanded = state === 'expanded';

  const waitForEverythingToLoad = useCallback(() => {
    return org && session.data;
  }, [org, session.data]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut({
        redirect: true,
        callbackUrl: getUriWithoutOrg(`/login?orgslug=${org?.slug}`),
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Could add toast notification here
    }
  }, [org?.slug]);

  const handleRetry = useCallback(() => {
    setError(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+B (or Cmd+B on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        event.stopPropagation();

        // Use the sidebar context toggle function
        if (typeof toggleSidebar === 'function') {
          toggleSidebar();
        }
      }
    };

    // Add event listener with capture to ensure it fires before other handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [toggleSidebar]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(false);

        // Simulate async loading with timeout
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (waitForEverythingToLoad()) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load sidebar data:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadData();
  }, [waitForEverythingToLoad, retryCount]);

  if (loading || !session.data?.user) {
    return <SidebarSkeleton />;
  }

  if (error) {
    return (
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="icon"
        className="border-r"
      >
        <SidebarContent>
          <SidebarError onRetry={handleRetry} />
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="icon"
      className={`border-r bg-sidebar/95 backdrop-blur-sm supports-[backdrop-filter]:bg-sidebar/60 transition-all duration-300 ${
        isCollapsed ? 'min-w-[4rem]' : 'min-w-[16rem]'
      } ${className}`}
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          <Link
            href="/"
            className={`flex items-center transition-all duration-200 hover:opacity-80 focus:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg p-1 -m-1 ${
              isCollapsed ? 'gap-0' : 'gap-3'
            }`}
            aria-label={t('ariaLabels.goToHomepage')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 p-1.5 shadow-sm">
              <Image
                alt={t('ariaLabels.openuLogo')}
                width={24}
                height={24}
                src={openuLogoLight}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              }`}
            >
              <h2 className="text-lg font-semibold text-sidebar-foreground leading-tight">{t('orgName')}</h2>
            </div>
          </Link>

          <SidebarTrigger
            className={`h-8 w-8 hover:bg-sidebar-accent rounded-md transition-all duration-200 ${
              isCollapsed ? 'opacity-100' : 'opacity-100'
            }`}
            aria-label={isExpanded ? t('ariaLabels.collapseSidebar') : t('ariaLabels.expandSidebar')}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-hidden">
        <AdminAuthorization authorizationMode="component">
          <SidebarGroup>
            <SidebarGroupContent className={isCollapsed ? 'px-2' : ''}>
              <SidebarMenu className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                {navigationItems.map((item) => (
                  <NavigationItem
                    key={item.href}
                    item={item}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </AdminAuthorization>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className={`flex flex-col gap-3 ${isCollapsed ? 'items-center' : ''}`}>
          <Separator className="bg-sidebar-border" />

          {/* User Profile Section */}
          <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'flex-col gap-2' : ''}`}>
            <div className="relative shrink-0">
              <UserAvatar
                size="sm"
                variant="outline"
              />
            </div>
            <div
              className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ${
                isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
              }`}
            >
              <p className="truncate text-sm font-medium text-sidebar-foreground">@{session.data.user.username}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{session.data.user.email}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={`flex gap-2 ${isCollapsed ? 'flex-col w-full' : ''}`}>
            <SidebarMenuButton
              asChild
              tooltip={isCollapsed ? t('tooltips.userSettings', { username: session.data.user.username }) : undefined}
              size="sm"
              className={`flex-1 transition-all duration-200 hover:bg-sidebar-accent/50 ${
                isCollapsed ? 'w-full justify-center' : ''
              }`}
            >
              <Link
                href="/dash/user-account/settings/general"
                className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : 'justify-center'}`}
                aria-label={t('ariaLabels.userSettings')}
              >
                <Settings
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                <span className={`transition-all duration-200 ${isCollapsed ? 'sr-only' : ''}`}>
                  {t('buttons.settings')}
                </span>
              </Link>
            </SidebarMenuButton>

            <SidebarMenuButton
              tooltip={isCollapsed ? t('tooltips.logout') : undefined}
              size="sm"
              onClick={handleLogout}
              className={`flex-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 ${
                isCollapsed ? 'w-full px-0 justify-center' : 'gap-2 px-3'
              }`}
            >
              <LogOut
                className="h-4 w-4"
                aria-hidden="true"
              />
              <span className={`transition-all duration-200 ${isCollapsed ? 'sr-only' : ''}`}>
                {t('buttons.logout')}
              </span>
            </SidebarMenuButton>
          </div>

          {/* Keyboard shortcut hint */}
          <div
            className={`flex items-center justify-center transition-all duration-300 ${
              isCollapsed ? 'opacity-0 hidden' : 'opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-1 text-xs text-sidebar-foreground/50">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">
                <span className="font-mono">
                  {typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
                    ? '⌘B'
                    : 'Ctrl+B'}
                </span>
              </kbd>
              <span>{t('keyboardShortcut.toToggle')}</span>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default memo(DashSidebar);
