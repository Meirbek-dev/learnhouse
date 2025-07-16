'use client';

import Tooltip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { getUriWithoutOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import { styled } from 'styled-components';
import { Settings } from 'lucide-react';
import { useEffect } from 'react';
import Link from 'next/link';

export const HeaderProfileBox = () => {
  const session = useLHSession() as any;
  const isUserAdmin = useAdminStatus();
  const org = useOrg() as any;
  const t = useTranslations('Header');

  useEffect(() => {}, [session]);

  return (
    <ProfileArea>
      {session.status === 'unauthenticated' && (
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-sm font-medium"
          >
            <Link
              href={{
                pathname: getUriWithoutOrg('/login'),
                query: org ? { orgslug: org.slug } : undefined,
              }}
            >
              {t('login')}
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="text-sm font-medium shadow-sm"
          >
            <Link
              href={{
                pathname: getUriWithoutOrg('/signup'),
                query: org ? { orgslug: org.slug } : undefined,
              }}
            >
              {t('signUp')}
            </Link>
          </Button>
        </div>
      )}
      {session.status === 'authenticated' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{session.data.user.username}</span>
            {isUserAdmin.isAdmin && (
              <Badge
                className="px-2 py-0.5 text-xs"
                variant="destructive"
              >
                {t('adminBadge')}
              </Badge>
            )}
          </div>
          <Tooltip
            content={t('tooltips.yourSettings')}
            sideOffset={15}
            side="bottom"
          >
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Link href={'/dash'}>
                <Settings size={16} />
              </Link>
            </Button>
          </Tooltip>
          <div className="flex items-center">
            <UserAvatar
              size="sm"
              variant="outline"
            />
          </div>
        </div>
      )}
    </ProfileArea>
  );
};

const ProfileArea = styled.div`
  display: flex;
  align-items: center;
`;
