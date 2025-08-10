'use client';

import { Activity, BarChart3, Bell, Database, Monitor, Target, Trophy, Users } from 'lucide-react';
import AdminDashboardPage from '@components/Dashboard/Pages/Admin/AdminDashboardPage';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { getUriWithOrg } from '@services/config/config';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { use } from 'react';

export interface AdminParams {
  subpage: string;
  orgslug: string;
}

const AdminPage = (props: { params: Promise<AdminParams> }) => {
  const params = use(props.params);
  const t = useTranslations('DashPage.Admin');
  const subpage = params.subpage || 'overview';

  const getPageTitle = () => {
    switch (subpage) {
      case 'overview': {
        return {
          h1: t('overview'),
          h2: t('overviewInfo'),
        };
      }
      case 'analytics': {
        return {
          h1: t('analytics'),
          h2: t('analyticsInfo'),
        };
      }
      case 'gamification': {
        return {
          h1: t('gamification'),
          h2: t('gamificationInfo'),
        };
      }
      case 'retention': {
        return {
          h1: t('retention'),
          h2: t('retentionInfo'),
        };
      }
      case 'realtime': {
        return {
          h1: t('realtime'),
          h2: t('realtimeInfo'),
        };
      }
      case 'alerts': {
        return {
          h1: t('alerts'),
          h2: t('alertsInfo'),
        };
      }
      case 'coursefunnels': {
        return {
          h1: t('courseFunnels'),
          h2: t('courseFunnelsInfo'),
        };
      }
      case 'actions': {
        return {
          h1: t('actions'),
          h2: t('actionsInfo'),
        };
      }
      default: {
        return {
          h1: t('title'),
          h2: t('adminDashboard'),
        };
      }
    }
  };

  const { h1, h2 } = getPageTitle();

  return (
    <div className="flex h-screen w-full flex-col bg-[#f8f8f8]">
      <div className="soft-shadow bg-background z-10 shrink-0 px-10 tracking-tight">
        <BreadCrumbs type="admin" />
        <div className="my-2 py-2">
          <div className="flex w-full flex-col space-y-1">
            <div className="flex pt-3 text-4xl font-bold tracking-tighter">{h1}</div>
            <div className="text-md flex font-medium text-gray-400">{h2}</div>
          </div>
        </div>
        <div className="flex space-x-0.5 overflow-x-auto text-sm font-bold">
          <div className="flex min-w-max space-x-0.5">
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/overview')}
              icon={<BarChart3 size={16} />}
              label={t('overview')}
              isActive={subpage === 'overview'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/analytics')}
              icon={<Database size={16} />}
              label={t('analytics')}
              isActive={subpage === 'analytics'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/gamification')}
              icon={<Trophy size={16} />}
              label={t('gamification')}
              isActive={subpage === 'gamification'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/retention')}
              icon={<Users size={16} />}
              label={t('retention')}
              isActive={subpage === 'retention'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/realtime')}
              icon={<Monitor size={16} />}
              label={t('realtime')}
              isActive={subpage === 'realtime'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/alerts')}
              icon={<Bell size={16} />}
              label={t('alerts')}
              isActive={subpage === 'alerts'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/coursefunnels')}
              icon={<Target size={16} />}
              label={t('courseFunnels')}
              isActive={subpage === 'coursefunnels'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/actions')}
              icon={<Activity size={16} />}
              label={t('actions')}
              isActive={subpage === 'actions'}
            />
          </div>
        </div>
      </div>
      <div className="h-6 shrink-0" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="flex-1 overflow-y-auto"
      >
        <AdminDashboardPage subpage={subpage} />
      </motion.div>
    </div>
  );
};

const TabLink = ({
  href,
  icon,
  label,
  isActive,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
}) => (
  <Link href={href}>
    <div
      className={`border-primary w-fit px-1 py-2 text-center whitespace-nowrap transition-all ease-linear ${
        isActive ? 'border-b-4' : 'opacity-50 hover:opacity-75'
      } cursor-pointer`}
    >
      <div className="mx-2 flex items-center space-x-2.5">
        {icon}
        <div className="text-xs md:text-sm">{label}</div>
      </div>
    </div>
  </Link>
);

export default AdminPage;
