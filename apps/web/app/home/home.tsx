'use client';

import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { swrFetcher } from '@services/utils/ts/requests';
import UserAvatar from '@components/Objects/UserAvatar';
import openuLogoDark from 'public/openu_logo_dark.webp';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { useEffect } from 'react';
import Image from 'next/image';
import useSWR from 'swr';

const HomeClient = () => {
  const t = useTranslations('HomeClient');
  const session = useLHSession();
  const access_token = session?.data?.tokens?.access_token;
  const { data: orgs } = useSWR(`${getAPIUrl()}orgs/user/page/1/limit/20`, (url) => swrFetcher(url, access_token), {
    revalidateOnFocus: false,
  });

  useEffect(() => {}, []);
  return (
    <div className="flex flex-col">
      <div className="mx-auto flex items-center space-x-4 rounded-b-2xl pt-16 text-3xl font-semibold">
        <Image
          quality={100}
          width={230}
          height={100}
          src={openuLogoDark}
          alt="CS MOOC logo"
        />
      </div>

      <div className="mx-auto flex items-center space-x-4 pt-16 text-2xl font-semibold">
        <span>{t('hello')},</span> <UserAvatar />{' '}
        <span className="capitalize">
          {session?.data?.user.first_name} {session?.data?.user.last_name}
        </span>
      </div>
      <div className="mx-auto flex cursor-pointer items-center space-x-4 pt-16 text-2xl font-semibold">
        <span onClick={() => signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })}>{t('signOut')}</span>
      </div>
    </div>
  );
};

export default HomeClient;
