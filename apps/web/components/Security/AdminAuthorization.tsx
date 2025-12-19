'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { getUriWithoutOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FC, ReactNode } from 'react';

interface AuthorizationProps {
  children: ReactNode;
  authorizationMode: 'component' | 'page';
}

const ADMIN_PATHS = [
  '/dash/org/*',
  '/dash/org',
  '/dash/users/*',
  '/dash/users',
  '/dash/courses/*',
  '/dash/courses',
  '/dash/org/settings/general',
];

const AdminAuthorization: FC<AuthorizationProps> = ({ children, authorizationMode }) => {
  const session = usePlatformSession();
  const org = useOrg() as any;
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const t = useTranslations('Security');

  const isUserAuthenticated = session.status === 'authenticated';

  function checkPathname(pattern: string, pathname: string) {
    if (typeof pattern !== 'string' || typeof pathname !== 'string') return false;
    const regexPattern = new RegExp(
      `^${pattern.replaceAll(/[$()+./?[\\]^{|}]/g, String.raw`\$&`).replaceAll(String.raw`\*`, '.*')}$`,
    );
    return regexPattern.test(pathname);
  }

  const isAdminPath = ADMIN_PATHS.some((path) => checkPathname(path, pathname));

  useEffect(() => {
    if (loading) return;
    if (!isUserAuthenticated) {
      router.push(getUriWithoutOrg(`/login?orgslug=${org?.slug ?? ''}`));
      return;
    }

    if (authorizationMode === 'page') {
      if (isAdminPath) {
        if (isAdmin) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          router.push('/dash');
        }
      } else {
        setIsAuthorized(true);
      }
    } else if (authorizationMode === 'component') {
      setIsAuthorized(isAdmin);
    }
  }, [loading, isUserAuthenticated, isAdmin, isAdminPath, authorizationMode, router, org?.slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageLoading />
      </div>
    );
  }

  if (authorizationMode === 'page' && !isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h1 className="text-2xl">{t('unauthorizedAccessMessage')}</h1>
      </div>
    );
  }

  // Always return a ReactNode
  return isAuthorized ? children : null;
};

export default AdminAuthorization;
