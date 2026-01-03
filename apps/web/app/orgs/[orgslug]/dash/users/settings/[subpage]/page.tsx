'use client';

import OrgUserGroups from '@components/Dashboard/Pages/Users/OrgUserGroups/OrgUserGroups';
import OrgUsersAdd from '@components/Dashboard/Pages/Users/OrgUsersAdd/OrgUsersAdd';
import { ScanEye, Shield, SquareUserRound, UserPlus, Users } from 'lucide-react';
import OrgAccess from '@components/Dashboard/Pages/Users/OrgAccess/OrgAccess';
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers';
import OrgRoles from '@components/Dashboard/Pages/Users/OrgRoles/OrgRoles';
import DesktopOnlyGuard from '@components/Dashboard/Misc/DesktopOnlyGuard';
import SettingsHeader from '@components/Dashboard/Misc/SettingsHeader';
import SettingsTabs from '@components/Dashboard/Misc/SettingsTabs';
import { getUriWithOrg } from '@services/config/config';
import { useTranslations } from 'next-intl';
import { use, useMemo } from 'react';

export interface SettingsParams {
  subpage: string;
  orgslug: string;
}

type SubpageType = 'users' | 'signups' | 'add' | 'usergroups' | 'roles';

interface TabConfig {
  id: SubpageType;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelKey: string;
  titleKey: string;
  descriptionKey: string;
  component: React.ComponentType;
}

const UsersSettingsPage = (props: { params: Promise<SettingsParams> }) => {
  const params = use(props.params);
  const t = useTranslations('DashPage.UserSettings');

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'users',
        icon: Users,
        labelKey: 'users',
        titleKey: 'usersTitle',
        descriptionKey: 'usersDescription',
        component: OrgUsers,
      },
      {
        id: 'usergroups',
        icon: SquareUserRound,
        labelKey: 'usergroups',
        titleKey: 'usergroupsTitle',
        descriptionKey: 'usergroupsDescription',
        component: OrgUserGroups,
      },
      {
        id: 'roles',
        icon: Shield,
        labelKey: 'roles',
        titleKey: 'rolesTitle',
        descriptionKey: 'rolesDescription',
        component: OrgRoles,
      },
      {
        id: 'signups',
        icon: ScanEye,
        labelKey: 'signups',
        titleKey: 'signupsTitle',
        descriptionKey: 'signupsDescription',
        component: OrgAccess,
      },
      {
        id: 'add',
        icon: UserPlus,
        labelKey: 'add',
        titleKey: 'addTitle',
        descriptionKey: 'addDescription',
        component: OrgUsersAdd,
      },
    ],
    [],
  );

  const currentTab: TabConfig = useMemo(
    () => tabs.find((tab) => tab.id === params.subpage) ?? tabs[0]!,
    [tabs, params.subpage],
  );

  const ActiveComponent = currentTab.component;

  return (
    <DesktopOnlyGuard>
      <div className="bg-background flex h-screen w-full flex-col">
        <SettingsHeader
          breadcrumbType="orgusers"
          title={t(currentTab.titleKey)}
          description={t(currentTab.descriptionKey)}
        >
          <SettingsTabs
            value={params.subpage}
            tabs={tabs}
            getHref={(tab) => `${getUriWithOrg(params.orgslug, '')}/dash/users/settings/${tab.id}`}
            translationNamespace="DashPage.UserSettings"
          />
        </SettingsHeader>

        <ActiveComponent />
      </div>
    </DesktopOnlyGuard>
  );
};

export default UsersSettingsPage;
