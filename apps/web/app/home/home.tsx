'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import platformLogoFull from 'public/platform_logo_full.svg';
import { getUriWithoutOrg } from '@services/config/config';
import UserAvatar from '@components/Objects/UserAvatar';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { useEffect } from 'react';
import Image from 'next/image';

const HomeClient = () => {
  const t = useTranslations('HomeClient');
  const session = usePlatformSession();

  useEffect(() => {}, []);
  return (
    <div className="flex flex-col">
      <div className="mx-auto flex items-center space-x-4 rounded-b-2xl pt-16 text-3xl font-semibold">
        <Image
          quality={100}
          width={230}
          src={platformLogoFull}
          alt="Ashyq Bilim logo"
          loading="eager"
        />
      </div>

      <div className="mx-auto flex items-center space-x-4 pt-16 text-2xl font-semibold">
        <span>{t('hello')},</span> <UserAvatar />{' '}
        <span className="capitalize">
          {[session?.data?.user.first_name, session?.data?.user.middle_name, session?.data?.user.last_name]
            .filter(Boolean)
            .join(' ')}
        </span>
      </div>
      <div className="mx-auto flex cursor-pointer items-center space-x-4 pt-16 text-2xl font-semibold">
        <span onClick={() => signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })}>{t('signOut')}</span>
      </div>
    </div>
  );
};

export default HomeClient;
