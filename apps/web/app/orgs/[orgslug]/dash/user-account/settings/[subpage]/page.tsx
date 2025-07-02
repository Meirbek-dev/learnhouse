'use client';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import UserEditGeneral from '@components/Dashboard/Pages/UserAccount/UserEditGeneral/UserEditGeneral';
import UserEditPassword from '@components/Dashboard/Pages/UserAccount/UserEditPassword/UserEditPassword';
import UserProfile from '@components/Dashboard/Pages/UserAccount/UserProfile/UserProfile';
import { getUriWithOrg } from '@services/config/config';
import { motion } from 'framer-motion';
import { Info, Lock, type LucideIcon, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { use, useEffect } from 'react';

interface User {
  username: string;
  // Add other user properties as needed
}

interface Session {
  user?: User;
  // Add other session properties as needed
}

export interface SettingsParams {
  subpage: string;
  orgslug: string;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

const SettingsNavigation = ({
  items,
  currentPage,
  orgslug,
}: {
  items: NavigationItem[];
  currentPage: string;
  orgslug: string;
}) => {
  const t = useTranslations('DashPage.UserAccountSettings');

  return (
    <div className="flex space-x-5 text-sm font-bold">
      {items.map((item) => (
        <Link
          key={item.id}
          href={getUriWithOrg(orgslug, `/dash/user-account/settings/${item.id}`)}
        >
          <div
            className={`border-primary w-fit py-2 text-center transition-all ease-linear ${
              currentPage === item.id ? 'border-b-4' : 'opacity-50'
            } cursor-pointer`}
          >
            <div className="mx-2 flex items-center space-x-2.5">
              <item.icon size={16} />
              <div>{t(item.label)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

function SettingsPage({ params }: { params: Promise<SettingsParams> }) {
  const t = useTranslations('DashPage.UserAccountSettings');
  const { subpage, orgslug } = use(params);
  const session = useLHSession() as Session;

  useEffect(() => {}, [session]);

  const navigationItems: NavigationItem[] = [
    {
      id: 'general',
      label: 'general',
      icon: Info,
      component: UserEditGeneral,
    },
    {
      id: 'profile',
      label: 'profile',
      icon: UserIcon,
      component: UserProfile,
    },
    {
      id: 'security',
      label: 'password',
      icon: Lock,
      component: UserEditPassword,
    },
  ];

  const CurrentComponent = navigationItems.find((item) => item.id === subpage)?.component;

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f8f8]">
      <div className="soft-shadow z-10 flex-shrink-0 bg-[#fcfbfc] pl-10 pr-10 tracking-tight">
        <BreadCrumbs
          type="user"
          last_breadcrumb={session?.user?.username}
        />
        <div className="my-2 tracking-tighter">
          <div className="w-100 flex justify-between">
            <div className="flex pt-3 text-4xl font-bold">{t('title')}</div>
          </div>
        </div>
        <SettingsNavigation
          items={navigationItems}
          currentPage={subpage}
          orgslug={orgslug}
        />
      </div>
      <div className="h-6 flex-shrink-0" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="flex-1 overflow-y-auto"
      >
        {CurrentComponent && <CurrentComponent />}
      </motion.div>
    </div>
  );
}

export default SettingsPage;
