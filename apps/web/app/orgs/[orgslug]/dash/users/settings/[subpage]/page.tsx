'use client';
import OrgUserGroups from '@components/Dashboard/Pages/Users/OrgUserGroups/OrgUserGroups';
import OrgUsersAdd from '@components/Dashboard/Pages/Users/OrgUsersAdd/OrgUsersAdd';
import { Monitor, ScanEye, SquareUserRound, UserPlus, Users } from 'lucide-react';
import OrgAccess from '@components/Dashboard/Pages/Users/OrgAccess/OrgAccess';
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { useIsMobile } from '@/hooks/use-mobile';
import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import Link from 'next/link';

export interface SettingsParams {
  subpage: string;
  orgslug: string;
}

function UsersSettingsPage(props: { params: Promise<SettingsParams> }) {
  const params = use(props.params);
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const t = useTranslations('DashPage.UserSettings');
  const [H1Label, setH1Label] = useState('');
  const [H2Label, setH2Label] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleLabels = () => {
      if (params.subpage === 'users') {
        setH1Label(t('usersTitle'));
        setH2Label(t('usersDescription'));
      }
      if (params.subpage === 'signups') {
        setH1Label(t('signupsTitle'));
        setH2Label(t('signupsDescription'));
      }
      if (params.subpage === 'add') {
        setH1Label(t('addTitle'));
        setH2Label(t('addDescription'));
      }
      if (params.subpage === 'usergroups') {
        setH1Label(t('usergroupsTitle'));
        setH2Label(t('usergroupsDescription'));
      }
    };

    handleLabels();
  }, [session, org, params.subpage, t]);

  if (isMobile) {
    // TODO: Work on a better mobile experience
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8f8f8] p-4">
        <div className="rounded-lg bg-white p-6 text-center shadow-md">
          <h2 className="mb-4 text-xl font-bold">{t('desktopOnlyTitle')}</h2>
          <Monitor
            className="mx-auto my-5"
            size={60}
          />
          <p>{t('desktopOnlyMessage1')}</p>
          <p>{t('desktopOnlyMessage2')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-screen w-full grid-rows-[auto_1fr] bg-[#f8f8f8]">
      <div className="z-10 bg-[#fcfbfc] pr-10 pl-10 tracking-tight shadow-[0px_4px_16px_rgba(0,0,0,0.06)]">
        <BreadCrumbs type="orgusers" />
        <div className="my-2 py-3">
          <div className="flex w-100 flex-col space-y-1">
            <div className="flex pt-3 text-4xl font-bold tracking-tighter">{H1Label}</div>
            <div className="text-md flex font-medium text-gray-400">{H2Label} </div>
          </div>
        </div>
        <div className="flex space-x-5 text-sm font-bold">
          <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/users/settings/users`}>
            <div
              className={`border-primary w-fit py-2 text-center transition-all ease-linear ${
                params.subpage === 'users' ? 'border-b-4' : 'opacity-50'
              } cursor-pointer`}
            >
              <div className="mx-2 flex items-center space-x-2.5">
                <Users size={16} />
                <div>{t('users')}</div>
              </div>
            </div>
          </Link>
          <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/users/settings/usergroups`}>
            <div
              className={`border-primary w-fit py-2 text-center transition-all ease-linear ${
                params.subpage === 'usergroups' ? 'border-b-4' : 'opacity-50'
              } cursor-pointer`}
            >
              <div className="mx-2 flex items-center space-x-2.5">
                <SquareUserRound size={16} />
                <div>{t('usergroups')}</div>
              </div>
            </div>
          </Link>
          <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/users/settings/signups`}>
            <div
              className={`border-primary w-fit py-2 text-center transition-all ease-linear ${
                params.subpage === 'signups' ? 'border-b-4' : 'opacity-50'
              } cursor-pointer`}
            >
              <div className="mx-2 flex items-center space-x-2.5">
                <ScanEye size={16} />
                <div>{t('signups')}</div>
              </div>
            </div>
          </Link>
          <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/users/settings/add`}>
            <div
              className={`border-primary w-fit py-2 text-center transition-all ease-linear ${
                params.subpage === 'add' ? 'border-b-4' : 'opacity-50'
              } cursor-pointer`}
            >
              <div className="mx-2 flex items-center space-x-2.5">
                <UserPlus size={16} />
                <div>{t('add')}</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="flex-1 overflow-y-auto"
      >
        {params.subpage === 'users' ? <OrgUsers /> : ''}
        {params.subpage === 'signups' ? <OrgAccess /> : ''}
        {params.subpage === 'add' ? <OrgUsersAdd /> : ''}
        {params.subpage === 'usergroups' ? <OrgUserGroups /> : ''}
      </motion.div>
    </div>
  );
}

export default UsersSettingsPage;
