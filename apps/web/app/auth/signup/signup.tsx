'use client';

import { getAPIUrl, getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { validateInviteCode } from '@services/organizations/invites';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { useCallback, useEffect, useRef, useState } from 'react';
import platformLogoFull from 'public/platform_logo_full.svg';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailWarning, Ticket, UserPlus } from 'lucide-react';
import InviteOnlySignUpComponent from './InviteOnlySignUp';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import { joinOrg } from '@services/organizations/orgs';
import { Button } from '@components/ui/button';
import OpenSignUpComponent from './OpenSignup';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { mutate } from 'swr';

interface SignUpClientProps {
  org: any;
}

const SignUpClient = (props: SignUpClientProps) => {
  const session = usePlatformSession() as any;
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get('inviteCode');

  const [joinMethod, setJoinMethod] = useState(() => {
    return props.org?.config?.config?.features.members.signup_mode || 'open';
  });

  const [inviteCode, setInviteCode] = useState(() => {
    return inviteCodeParam || '';
  });

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
              height={100}
              src={platformLogoFull}
              alt="Ashyq Bilim logo"
              style={{ width: 'auto', height: 'auto' }}
            />
          </Link>
        </div>
        {joinMethod === 'open' &&
          (session.status === 'authenticated' ? (
            <LoggedInJoinScreen inviteCode={inviteCode} />
          ) : (
            <OpenSignUpComponent />
          ))}
        {joinMethod === 'inviteOnly' &&
          (inviteCode ? (
            session.status === 'authenticated' ? (
              <LoggedInJoinScreen inviteCode={inviteCode} />
            ) : (
              <InviteOnlySignUpComponent inviteCode={inviteCode} />
            )
          ) : (
            <NoTokenScreen />
          ))}
      </div>
    </div>
  );
};

const LoggedInJoinScreen = (props: any) => {
  const t = useTranslations('Auth.Signup');
  const toastT = useTranslations('ToastMessages');
  const session = usePlatformSession() as any;
  const org = useOrg() as any;
  const [_isLoading, setIsLoading] = useState(true);
  const [isSumbitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const autoJoinAttempted = useRef(false);

  const accessToken = session?.data?.tokens?.access_token;
  const userId = session?.data?.user?.id;

  const join = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const res = await joinOrg(
        {
          org_id: org.id,
          user_id: userId,
          invite_code: props.inviteCode,
        },
        null,
        accessToken,
      );

      const alreadyMemberMessage = res.data?.detail;
      const isAlreadyMember =
        typeof alreadyMemberMessage === 'string' && alreadyMemberMessage.toLowerCase().includes('уже является частью');

      if (res.success || isAlreadyMember) {
        if (isAlreadyMember) {
          toast.success(alreadyMemberMessage);
        } else {
          toast.success(res.data?.message || toastT('orgJoinSuccess'));
        }

        // Ensure org context reflects the membership change.
        void mutate(`${getAPIUrl()}orgs/user/page/1/limit/20`);
        void mutate(`${getAPIUrl()}orgs/slug/${org.slug}`);

        setTimeout(() => {
          router.push(getUriWithOrg(org.slug, '/'));
        }, 1500);
      } else {
        // Handle validation errors properly
        let errorMessage = toastT('errorSomethingWentWrong');

        if (res.data?.detail) {
          errorMessage = res.data.detail;
        } else if (Array.isArray(res.data)) {
          errorMessage = res.data.map((err: any) => err.msg || err.message).join(', ');
        }

        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Join org error:', error);
      toast.error(error.message || toastT('errorSomethingWentWrong'));
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  }, [accessToken, org.id, org.slug, props.inviteCode, router, toastT, userId]);

  useEffect(() => {
    if (session && org) {
      setIsLoading(false);
    }
  }, [org, session]);

  useEffect(() => {
    if (session?.status !== 'authenticated' || !org?.id || !userId || autoJoinAttempted.current) {
      return;
    }

    autoJoinAttempted.current = true;
    void join();
  }, [join, org?.id, session?.status, userId]);

  return (
    <div className="mx-auto flex flex-row items-center">
      <Toast />
      <div className="flex flex-col items-center justify-center space-y-7">
        <p className="flex items-center justify-center space-x-2 pt-3 text-2xl font-semibold text-black/70">
          <span className="items-center">{t('hi')}</span>
          <span className="flex items-center space-x-2 capitalize">
            <UserAvatar
              size="sm"
              variant="outline"
            />
            <span>{session.data.username},</span>
          </span>
          <span>{t('joinQuestion', { orgName: org?.name })}</span>
        </p>
        <Button
          onClick={join}
          disabled={isSumbitting}
          className="h-[35px] text-base font-semibold"
        >
          {isSumbitting ? (
            <BarLoader
              cssOverride={{ borderRadius: 60 }}
              width={60}
              color="#ffffff"
            />
          ) : (
            <>
              <UserPlus size={18} />
              <p>{t('join')}</p>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

const NoTokenScreen = (_props: any) => {
  const t = useTranslations('Auth.Signup');
  const toastT = useTranslations('ToastMessages');
  const session = usePlatformSession() as any;
  const org = useOrg() as any;
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(() => {
    // Check if session and org are already available
    return !(session && org);
  });
  const [inviteCode, setInviteCode] = useState('');

  const handleInviteCodeChange = (e: any) => {
    setInviteCode(e.target.value);
  };

  const validateCode = async () => {
    setIsLoading(true);
    const res = await validateInviteCode(org?.id, inviteCode, session?.user?.tokens.access_token);
    // wait for 1.5s
    if (res.success) {
      toast.success(toastT('inviteCodeValid'));
      setTimeout(() => {
        router.push(getUriWithoutOrg(`/signup?inviteCode=${inviteCode}&orgslug=${org.slug}`));
      }, 1500);
    } else {
      toast.error(res.data?.detail || toastT('inviteCodeInvalid'));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session && org) {
      // Use setTimeout to break out of render phase
      const timeout = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timeout);
    }
  }, [org, session]);

  return (
    <div className="mx-auto flex flex-row items-center">
      <Toast />
      {isLoading ? (
        <div className="flex w-[300px] flex-col items-center justify-center space-y-7">
          <PageLoading />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-7">
          <p className="flex items-center space-x-2 text-lg font-medium text-red-800">
            <MailWarning size={18} />
            <span>{t('inviteCodeRequired', { orgName: org?.name })}</span>
          </p>
          <Input
            onChange={handleInviteCodeChange}
            className="h-[50px] w-[300px]"
            placeholder={t('enterInviteCode')}
            type="text"
          />
          <Button
            onClick={validateCode}
            className="flex h-fit items-center rounded-lg px-6 py-2 text-base font-semibold shadow-md"
          >
            <Ticket size={18} />
            <p>{t('submit')}</p>
          </Button>
        </div>
      )}
    </div>
  );
};

export default SignUpClient;
