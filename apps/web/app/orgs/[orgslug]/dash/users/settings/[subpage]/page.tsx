'use client';

import OrgUserGroups from '@components/Dashboard/Pages/Users/OrgUserGroups/OrgUserGroups';
import { Actions, Resources, Scopes, usePermissions } from '@/components/Security';
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers';
import OrgRoles from '@components/Dashboard/Pages/Users/OrgRoles/OrgRoles';
import DesktopOnlyGuard from '@components/Dashboard/Misc/DesktopOnlyGuard';
import SettingsHeader from '@components/Dashboard/Misc/SettingsHeader';
import SettingsTabs from '@components/Dashboard/Misc/SettingsTabs';
import { Shield, SquareUserRound, Users } from 'lucide-react';
import { getUriWithOrg } from '@services/config/config';
import { useTranslations } from 'next-intl';
import { use, useMemo } from 'react';

export interface SettingsParams {
  subpage: string;
  orgslug: string;
}

type SubpageType = 'users' | 'usergroups' | 'roles';

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
  const { can } = usePermissions();

  const allTabs: TabConfig[] = useMemo(
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
    ],
    [],
  );

  const tabs = useMemo(() => {
    return allTabs.filter((tab) => {
      switch (tab.id) {
        case 'users':
          return (
            can(Actions.READ, Resources.USER, Scopes.ORG) ||
            can(Actions.INVITE, Resources.USER, Scopes.ORG) ||
            can(Actions.UPDATE, Resources.USER, Scopes.ORG)
          );
        case 'usergroups':
          return can(Actions.MANAGE, Resources.USERGROUP, Scopes.ORG);
        case 'roles':
          return can(Actions.READ, Resources.ROLE, Scopes.ORG);
        default:
          return true;
      }
    });
  }, [allTabs, can]);

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
