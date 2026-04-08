'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import { logout } from '@/services/auth/auth';
import { mutate } from 'swr';
import platformLogoFull from '@public/platform_logo_full.svg';
import UserAvatar from '@components/Objects/UserAvatar';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

const HomeClient = () => {
  const t = useTranslations('HomeClient');
  const viewer = useCurrentUser();

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex items-center space-x-4 rounded-b-2xl pt-16 text-3xl font-semibold">
        <Image
          quality={100}
          width={230}
          src={platformLogoFull}
          alt="Ashyq Bilim logo"
          style={{ height: 'auto' }}
          loading="eager"
        />
      </div>

      <div className="mx-auto flex items-center space-x-4 pt-16 text-2xl font-semibold">
        <span>{t('hello')},</span> <UserAvatar />{' '}
        <span className="capitalize">
          {[viewer?.first_name, viewer?.middle_name, viewer?.last_name].filter(Boolean).join(' ')}
        </span>
      </div>
      <div className="mx-auto flex cursor-pointer items-center space-x-4 pt-16 text-2xl font-semibold">
        <span
          onClick={() => {
            void mutate(AUTH_SESSION_SWR_KEY, null, { revalidate: false });
            void logout();
          }}
        >
          {t('signOut')}
        </span>
      </div>
    </div>
  );
};

export default HomeClient;
