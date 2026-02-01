'use client';

import { Backpack, BadgeDollarSign, BookCopy, Home, School, Settings, Users } from 'lucide-react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { usePaymentsEnabled } from '@components/Hooks/usePaymentsEnabled';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import { usePermissions, Actions, ResourceTypes } from '@/components/Security';
import AppLink from '@/components/ui/AppLink';
import { useTranslations } from 'next-intl';

const DashMobileMenu = () => {
  const session = usePlatformSession() as any;
  const t = useTranslations('SidebarMenu');
  const { isEnabled: arePaymentsEnabled } = usePaymentsEnabled();
  const { can } = usePermissions();

  // Check if user has organization management rights using permission hook
  const canManageOrganization = can(Actions.MANAGE, ResourceTypes.ORGANIZATION);

  return (
    <div
      style={{
        background:
          'linear-gradient(160deg, #0c1222 0%, #1a2332 30%, #2d3748 60%, #4a5568 100%), radial-gradient(ellipse at top left, rgba(99, 179, 237, 0.12) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(167, 139, 250, 0.08) 0%, transparent 60%)',
      }}
      className="fixed right-0 bottom-0 left-0 z-50 text-white shadow-xl backdrop-blur-lg"
    >
      <div className="flex h-16 items-center justify-around px-2">
        <ToolTip
          content={t('tooltips.home')}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <AppLink
            href="/"
            className="flex flex-col items-center p-2"
            aria-label={t('ariaLabels.home')}
          >
            <Home size={20} />
            <span className="mt-1 text-xs">{t('mobile.home')}</span>
          </AppLink>
        </ToolTip>
        <ToolTip
          content={t('tooltips.courses')}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <AppLink
            href="/dash/courses"
            className="flex flex-col items-center p-2"
            aria-label={t('ariaLabels.manageCourses')}
          >
            <BookCopy size={20} />
            <span className="mt-1 text-xs">{t('mobile.courses')}</span>
          </AppLink>
        </ToolTip>
        <ToolTip
          content={t('tooltips.assignments')}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <AppLink
            href="/dash/assignments"
            className="flex flex-col items-center p-2"
            aria-label={t('ariaLabels.manageAssignments')}
          >
            <Backpack size={20} />
            <span className="mt-1 text-xs">{t('mobile.assignments')}</span>
          </AppLink>
        </ToolTip>
        {arePaymentsEnabled ? (
          <ToolTip
            content={t('tooltips.payments')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <AppLink
              href="/dash/payments/customers"
              className="flex flex-col items-center p-2"
              aria-label={t('ariaLabels.managePayments')}
            >
              <BadgeDollarSign size={20} />
              <span className="mt-1 text-xs">{t('mobile.payments')}</span>
            </AppLink>
          </ToolTip>
        ) : null}
        <ToolTip
          content={t('tooltips.users')}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <AppLink
            href="/dash/users/settings/users"
            className="flex flex-col items-center p-2"
            aria-label={t('ariaLabels.manageUsers')}
          >
            <Users size={20} />
            <span className="mt-1 text-xs">{t('mobile.users')}</span>
          </AppLink>
        </ToolTip>
        {canManageOrganization ? (
          <ToolTip
            content={t('tooltips.organization')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <AppLink
              href="/dash/org/settings/general"
              className="flex flex-col items-center p-2"
              aria-label={t('ariaLabels.organizationSettings')}
            >
              <School size={20} />
              <span className="mt-1 text-xs">{t('mobile.org')}</span>
            </AppLink>
          </ToolTip>
        ) : null}
        <ToolTip
          content={t('tooltips.userSettings', {
            username: session.data.user.username,
          })}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <AppLink
            href="/dash/user-account/settings/general"
            className="flex flex-col items-center p-2"
            aria-label={t('ariaLabels.userAccountSettings')}
          >
            <Settings size={20} />
            <span className="mt-1 text-xs">{t('mobile.settings')}</span>
          </AppLink>
        </ToolTip>
      </div>
    </div>
  );
};

export default DashMobileMenu;
