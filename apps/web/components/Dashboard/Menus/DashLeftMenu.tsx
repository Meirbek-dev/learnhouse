'use client';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import useFeatureFlag from '@components/Hooks/useFeatureFlag';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import AdminAuthorization from '@components/Security/AdminAuthorization';
import openuLogoLight from '@public/openu_logo_light.png';
import { getUriWithoutOrg } from '@services/config/config';
import { Backpack, BadgeDollarSign, BookCopy, Home, LogOut, School, Settings, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import UserAvatar from '../../Objects/UserAvatar';

function DashLeftMenu() {
  const org = useOrg() as any;
  const session = useLHSession();
  const [loading, setLoading] = useState(true);
  const isPaymentsEnabled = useFeatureFlag({
    path: ['features', 'payments', 'enabled'],
    defaultValue: false,
  });
  const t = useTranslations('DashboardMenu');

  const waitForEverythingToLoad = useCallback(() => {
    return org && session.data;
  }, [org, session.data]);

  async function logOutUI() {
    await signOut({
      redirect: true,
      callbackUrl: getUriWithoutOrg(`/login?orgslug=${org.slug}`),
    });
  }

  useEffect(() => {
    if (waitForEverythingToLoad()) {
      setLoading(false);
    }
  }, [waitForEverythingToLoad]);

  if (loading || !session.data?.user) {
    return null;
  }

  return (
    <div
      style={{
        background:
          'linear-gradient(160deg, oklch(0.15 0.02 250) 0%, oklch(0.25 0.04 255) 30%, oklch(0.35 0.08 260) 60%, oklch(0.45 0.12 265) 100%), radial-gradient(ellipse at top, oklch(0.5461 0.2152 262.8809 / 0.08) 0%, transparent 70%), oklch(0.2 0.03 258)',
      }}
      className="sticky top-0 flex h-screen w-[90px] flex-col text-white shadow-xl"
    >
      <div className="flex h-full flex-col">
        <div className="mt-6 flex h-auto">
          <Link
            className="mx-auto flex flex-col items-center space-y-3"
            href={'/'}
          >
            <ToolTip
              content={t('tooltips.backToHome')}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <Image
                alt="OpenU лого"
                width={52}
                src={openuLogoLight}
              />
            </ToolTip>
          </Link>
        </div>
        <div className="mx-auto flex grow flex-col items-center justify-center space-y-5">
          {/* <ToolTip content={"Back to " + org?.name + "'s Home"} slateBlack sideOffset={8} side='right'  >
                        <Link className='bg-white text-black hover:text-white rounded-lg p-2 hover:bg-white/10 transition-all ease-linear' href={`/`} ><ArrowLeft className='hover:text-white' size={18} /></Link>
                    </ToolTip> */}
          <AdminAuthorization authorizationMode="component">
            <ToolTip
              content={t('tooltips.home')}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <Link
                className="rounded-lg bg-white/5 p-2 transition-all ease-linear hover:bg-white/10"
                href={'/dash'}
              >
                <Home size={18} />
              </Link>
            </ToolTip>
            <ToolTip
              content={t('tooltips.courses')}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <Link
                className="rounded-lg bg-white/5 p-2 transition-all ease-linear hover:bg-white/10"
                href={'/dash/courses'}
              >
                <BookCopy size={18} />
              </Link>
            </ToolTip>
            <ToolTip
              content={t('tooltips.assignments')}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <Link
                className="rounded-lg bg-white/5 p-2 transition-all ease-linear hover:bg-white/10"
                href={'/dash/assignments'}
              >
                <Backpack size={18} />
              </Link>
            </ToolTip>
            <ToolTip
              content={t('tooltips.users')}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <Link
                className="rounded-lg bg-white/5 p-2 transition-all ease-linear hover:bg-white/10"
                href={'/dash/users/settings/users'}
              >
                <Users size={18} />
              </Link>
            </ToolTip>
            {isPaymentsEnabled && (
              <ToolTip
                content={t('tooltips.payments')}
                slateBlack
                sideOffset={8}
                side="right"
              >
                <Link
                  className="rounded-lg bg-white/5 p-2 transition-all ease-linear hover:bg-white/10"
                  href={'/dash/payments/customers'}
                >
                  <BadgeDollarSign size={18} />
                </Link>
              </ToolTip>
            )}
            <ToolTip
              content={t('tooltips.organization')}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <Link
                className="rounded-lg bg-white/5 p-2 transition-all ease-linear hover:bg-white/10"
                href={'/dash/org/settings/general'}
              >
                <School size={18} />
              </Link>
            </ToolTip>
          </AdminAuthorization>
        </div>
        <div className="mx-auto flex flex-col space-y-2 pb-7">
          <div className="flex flex-col items-center space-y-2">
            <ToolTip
              content={`@${session.data.user.username}`}
              slateBlack
              sideOffset={8}
              side="right"
            >
              <div className="mx-auto">
                <UserAvatar
                  border="border-4"
                  width={35}
                />
              </div>
            </ToolTip>
            <div className="flex flex-col items-center space-y-3">
              <div className="flex flex-col space-y-1 py-1">
                <ToolTip
                  content={t('tooltips.userSettings', {
                    username: session.data.user.username,
                  })}
                  slateBlack
                  sideOffset={8}
                  side="right"
                >
                  <Link
                    href={'/dash/user-account/settings/general'}
                    className="py-1"
                  >
                    <Settings
                      className="mx-auto cursor-pointer text-neutral-400"
                      size={18}
                    />
                  </Link>
                </ToolTip>
              </div>
              <ToolTip
                content={t('tooltips.logout')}
                slateBlack
                sideOffset={8}
                side="right"
              >
                <LogOut
                  onClick={() => logOutUI()}
                  className="mx-auto cursor-pointer text-neutral-400"
                  size={14}
                />
              </ToolTip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashLeftMenu;
