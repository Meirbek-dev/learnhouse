'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import { createContext, useContext, useEffect, useRef } from 'react';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { Home, LogOut, PersonStanding } from 'lucide-react';
import { swrFetcher } from '@services/utils/ts/requests';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Org } from '@/types/org';
import type { ReactNode } from 'react';
import useSWR from 'swr';

export const OrgContext = createContext<Org | null>(null);

export const OrgProvider = ({ children, orgslug }: { children: ReactNode; orgslug: string }) => {
  const session = usePlatformSession();
  const pathname = usePathname();
  const accessToken = session?.data?.tokens?.access_token;
  const isAuthenticated = session.status === 'authenticated' && Boolean(accessToken);
  const t = useTranslations('Contexts.Org');
  const isAllowedPathname = ['/login', '/signup'].includes(pathname);

  const handleSignOut = async () => {
    await signOut({
      redirect: true,
      callbackUrl: getUriWithoutOrg('/login?orgslug=' + orgslug),
    });
  };

  const {
    data: org,
    error: orgError,
    isLoading: isOrgLoading,
  } = useSWR(`${getAPIUrl()}orgs/slug/${orgslug}`, (url) => swrFetcher(url, accessToken));
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
    },
  );

  const isLoading = session.status === 'loading' || isOrgLoading || (isAuthenticated && isUserOrgsLoading);
  const hasError = Boolean(orgError) || (isAuthenticated && Boolean(orgsError));

  // Refresh session permissions when org changes
  const { update: updateSession } = useSession();
  const prevOrgIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!org?.id || !isAuthenticated) return;
    const sessionOrgId = (session?.data as any)?.permissions_org_id;

    // Set the current_org_id cookie so the session callback picks up the right org
    if (prevOrgIdRef.current !== org.id) {
      document.cookie = `current_org_id=${org.id};path=/;max-age=${60 * 60 * 24 * 365}`;
      prevOrgIdRef.current = org.id;
    }

    // If session permissions are for a different org, trigger a refresh
    if (sessionOrgId !== null && sessionOrgId !== org.id) {
      updateSession();
    }
  }, [org?.id, isAuthenticated, session?.data, updateSession]);

  const isUserPartOfTheOrg = (() => {
    if (!isAuthenticated || !org?.id || !Array.isArray(orgs)) {
      return false;
    }
    return orgs.some((userOrg: any) => userOrg.id === org.id);
  })();

  if (hasError) return <ErrorUI message={t('fetchError')} />;
  if (isLoading) return <PageLoading />;
  if (!isUserPartOfTheOrg && session.status === 'authenticated' && !isAllowedPathname) {
    return (
      <div className="mx-auto flex flex-col items-center space-y-6 bg-linear-to-b from-yellow-100 to-yellow-100/5 py-10 antialiased ">
        <div className="flex flex-row items-center space-x-5 rounded-xl ">
          <div className="text-yellow-700">
            <PersonStanding size={45} />
          </div>
          <div className="flex flex-col">
            <p className="text-3xl font-bold text-yellow-700">{t('notMemberInfo')}</p>
          </div>
        </div>
        <div className="flex space-x-4">
          <a
            href={getUriWithoutOrg('/home')}
            className="flex items-center space-x-2 rounded-full bg-gray-700 px-4 py-1 text-gray-200 shadow-lg transition-all ease-linear hover:bg-gray-800 "
          >
            <Home
              className="text-gray-200"
              size={17}
            />
            <span className="text-md font-bold">{t('home')}</span>
          </a>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 rounded-full bg-red-700 px-4 py-1 text-red-200 shadow-lg transition-all ease-linear hover:bg-red-800 "
          >
            <LogOut
              className="text-red-200"
              size={17}
            />
            <span className="text-md font-bold">{t('signOut')}</span>
          </button>
        </div>
      </div>
    );
  }

  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
};

export function useOrg(): Org | null {
  return useContext(OrgContext);
}
