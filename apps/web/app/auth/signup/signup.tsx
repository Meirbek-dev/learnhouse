'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import platformLogoFull from '@public/platform_logo_full.svg';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useEffect } from 'react';
import Image from 'next/image';

interface SignUpClientProps {
  org: any;
}

const SignUpClient = (props: SignUpClientProps) => {
  const session = usePlatformSession() as any;
  const router = useRouter();
  const org = useOrg() as any;
  const t = useTranslations('Auth.Signup');

  // Redirect authenticated users to home page
  // They're already auto-joined to 'openu' during registration
  useEffect(() => {
    if (session?.status === 'authenticated' && org?.slug) {
      router.push(getUriWithOrg(org.slug, '/'));
    }
  }, [session?.status, org?.slug, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-neutral-100">
      <div className="rounded-xl border-2 bg-white p-12 shadow-lg">
        <div className="flex justify-center pb-8">
          <Link
            prefetch={false}
            href={getUriWithOrg(props.org.slug, '/')}
          >
            <Image
              quality={100}
              width={230}
              src={platformLogoFull}
              alt="Ashyq Bilim logo"
              style={{ height: 'auto' }}
              loading="eager"
            />
          </Link>
        </div>
        {session.status === 'authenticated' ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <p className="text-lg text-neutral-600">{t('redirecting')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            {/* TODO: Add signup form component here */}
            {/* Users will be automatically joined to 'openu' organization on signup */}
            {/* Use the signup() function from @services/auth/auth.ts */}
            <p className="text-center text-neutral-600">
              {t('formComponentNeeded')}
              <br />
              <span className="text-sm">{t('autoJoinDefaultOrg')}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUpClient;
