'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { Home, LogOut, PersonStanding } from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import { swrFetcher } from '@services/utils/ts/requests';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import type { ReactNode } from 'react';
import useSWR from 'swr';

export const OrgContext = createContext(null);

export const OrgProvider = ({ children, orgslug }: { children: ReactNode; orgslug: string }) => {
  const session = usePlatformSession();
  const pathname = usePathname();
  const accessToken = session?.data?.tokens?.access_token;
  const t = useTranslations('Contexts.Org');
  const isAllowedPathname = ['/login', '/signup'].includes(pathname);

  const handleSignOut = async () => {
    await signOut({
      redirect: true,
      callbackUrl: getUriWithoutOrg('/login?orgslug=' + orgslug),
    });
  };

  const { data: org, error: orgError } = useSWR(`${getAPIUrl()}orgs/slug/${orgslug}`, (url) =>
    swrFetcher(url, accessToken),
  );
  const { data: orgs, error: orgsError } = useSWR(`${getAPIUrl()}orgs/user/page/1/limit/20`, (url) =>
    swrFetcher(url, accessToken),
  );

  const isLoading = !(org && orgs && session) || session.status === 'loading';
  const hasError = orgError || orgsError;

  const isOrgActive = useMemo(() => org?.config?.config?.general?.enabled !== false, [org]);
  const isUserPartOfTheOrg = useMemo(() => orgs?.some((userOrg: any) => userOrg.id === org?.id), [orgs, org?.id]);

  if (hasError) return <ErrorUI message={t('fetchError')} />;
  if (isLoading) return <PageLoading />;
  if (!isOrgActive) return <ErrorUI message={t('orgInactiveError')} />;
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
            href={getUriWithoutOrg(`/signup?orgslug=${orgslug}`)}
            className="flex items-center space-x-2 rounded-full bg-yellow-700 px-4 py-1 text-yellow-200 shadow-lg transition-all ease-linear hover:bg-yellow-800 "
          >
            <PersonStanding
              className="text-yellow-200"
              size={17}
            />
            <span className="text-md font-bold">{t('joinOrgCTA', { orgName: org?.name })}</span>
          </a>
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

export function useOrg() {
  return useContext(OrgContext as any);
}
