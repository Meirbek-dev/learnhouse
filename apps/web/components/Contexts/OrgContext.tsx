'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import ErrorUI from '@/components/Objects/Elements/Error/Error';
import { Home, LogOut, PersonStanding } from 'lucide-react';
import { swrFetcher } from '@services/utils/ts/requests';
import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import type { Org } from '@/types/org';
import type { ReactNode } from 'react';
import useSWR from 'swr';

export const PlatformOrgContext = createContext<Org | null>(null);

export const PlatformOrgContextProvider = ({ children, initialOrg }: { children: ReactNode; initialOrg?: any }) => {
  const session = usePlatformSession();
  const pathname = usePathname();
  const accessToken = session?.data?.tokens?.access_token;
  const isAuthenticated = session.status === 'authenticated' && Boolean(accessToken);
  const t = useTranslations('Contexts.Org');
  const isAllowedPathname =
    pathname.startsWith('/auth/') || ['/login', '/signup', '/forgot', '/reset'].includes(pathname);
  const orgContextKey = `${getAPIUrl()}orgs/platform`;

  const handleSignOut = async () => {
    await signOut({
      redirect: true,
      callbackUrl: getUriWithoutOrg('/login'),
    });
  };

  const {
    data: org,
    error: orgError,
    isLoading: isOrgLoading,
  } = useSWR(orgContextKey, (url: string) => swrFetcher(url, accessToken), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: !initialOrg,
    fallbackData: initialOrg || undefined,
  });

  const {
    data: orgs,
    error: orgsError,
    isLoading: isUserOrgsLoading,
  } = useSWR(
    // Skip user-specific org fetches when unauthenticated to prevent hammering rate-limited endpoints.
    isAuthenticated ? `${getAPIUrl()}orgs/user/page/1/limit/20` : null,
    (url) => swrFetcher(url, accessToken),
    {
      // Revalidate on mount but use global dedupingInterval (60s) to prevent hammering.
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Only show loading on initial load (no cached data), not during revalidation
  const isLoading =
    session.status === 'loading' || (!org && isOrgLoading) || (isAuthenticated && !orgs && isUserOrgsLoading);
  const hasError = Boolean(orgError) || (isAuthenticated && Boolean(orgsError));

  const isUserPartOfTheOrg: boolean = (() => {
    if (!isAuthenticated || !org?.id || !Array.isArray(orgs)) {
      return false;
    }
    return orgs.some((userOrg: any) => userOrg.id === org.id);
  })();

  if (hasError) return <ErrorUI message={t('fetchError')} />;
  if (isLoading) return <PageLoading />;
  if (!isUserPartOfTheOrg && session.status === 'authenticated' && !isAllowedPathname) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center space-y-6 rounded-2xl border bg-card p-8 antialiased">
        <div className="flex flex-row items-center space-x-5 rounded-xl">
          <div className="text-muted-foreground">
            <PersonStanding size={45} />
          </div>
          <div className="flex flex-col">
            <p className="text-3xl font-bold text-foreground">{t('notMemberInfo')}</p>
          </div>
        </div>
        <div className="flex space-x-4">
          <a
            href={getUriWithoutOrg('/home')}
            className="flex items-center space-x-2 rounded-full border bg-muted px-4 py-1 text-foreground transition-colors hover:bg-muted/80"
          >
            <Home
              className="text-foreground"
              size={17}
            />
            <span className="text-md font-bold">{t('home')}</span>
          </a>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 rounded-full bg-destructive px-4 py-1 text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <LogOut
              className="text-destructive-foreground"
              size={17}
            />
            <span className="text-md font-bold">{t('signOut')}</span>
          </button>
        </div>
      </div>
    );
  }

  return <PlatformOrgContext.Provider value={org}>{children}</PlatformOrgContext.Provider>;
};

export function usePlatformOrg(): Org | null {
  return useContext(PlatformOrgContext);
}

export function usePlatformOrgId(): number {
  return 1;
}
