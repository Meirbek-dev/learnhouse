'use client';

import { BarChart3, Database, Settings, Trophy, Users, Monitor, Bell, Target, PieChart, Activity } from 'lucide-react';
import AdminDashboardPage from '@components/Dashboard/Pages/Admin/AdminDashboardPage';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { useOrg } from '@components/Contexts/OrgContext';
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
  const _session = useLHSession() as any;
  const _org = useOrg() as any;
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
      case 'system': {
        return {
          h1: t('system'),
          h2: t('systemInfo'),
        };
      }
      case 'gamification': {
        return {
          h1: t('gamification'),
          h2: 'Gamification metrics and user engagement',
        };
      }
      case 'retention': {
        return {
          h1: t('retention'),
          h2: 'User retention and cohort analysis',
        };
      }
      case 'realtime': {
        return {
          h1: t('realtime'),
          h2: 'Live monitoring and real-time metrics',
        };
      }
      case 'alerts': {
        return {
          h1: t('alerts'),
          h2: 'System alerts and notifications',
        };
      }
      case 'coursefunnels': {
        return {
          h1: t('courseFunnels'),
          h2: 'Course completion funnels and analysis',
        };
      }
      case 'actions': {
        return {
          h1: t('actions'),
          h2: 'Bulk operations and administrative actions',
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
      <div className="soft-shadow z-10 shrink-0 bg-[#fcfbfc] pr-10 pl-10 tracking-tight">
        <BreadCrumbs type="admin" />
        <div className="my-2 py-2">
          <div className="flex w-100 flex-col space-y-1">
            <div className="flex pt-3 text-4xl font-bold tracking-tighter">{h1}</div>
            <div className="text-md flex font-medium text-gray-400">{h2}</div>
          </div>
        </div>
        <div className="flex space-x-0.5 text-sm font-bold overflow-x-auto">
          <div className="flex space-x-0.5 min-w-max">
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
              href={getUriWithOrg(params.orgslug, '/dash/admin/system')}
              icon={<Settings size={16} />}
              label={t('system')}
              isActive={subpage === 'system'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/gamification')}
              icon={<Trophy size={16} />}
              label="Gamification"
              isActive={subpage === 'gamification'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/retention')}
              icon={<Users size={16} />}
              label="Retention"
              isActive={subpage === 'retention'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/realtime')}
              icon={<Monitor size={16} />}
              label="Real-time"
              isActive={subpage === 'realtime'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/alerts')}
              icon={<Bell size={16} />}
              label="Alerts"
              isActive={subpage === 'alerts'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/coursefunnels')}
              icon={<Target size={16} />}
              label="Course Funnels"
              isActive={subpage === 'coursefunnels'}
            />
            <TabLink
              href={getUriWithOrg(params.orgslug, '/dash/admin/actions')}
              icon={<Activity size={16} />}
              label="Actions"
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
      className={`border-primary w-fit py-2 px-1 text-center transition-all ease-linear whitespace-nowrap ${
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
