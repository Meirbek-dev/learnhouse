'use client';

import { Backpack, BadgeDollarSign, BookCopy, Home, School, Settings, ShieldCheck, Users } from 'lucide-react';
import { Actions, Resources, Scopes, usePermissions } from '@/components/Security';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { usePaymentsEnabled } from '@components/Hooks/usePaymentsEnabled';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import AppLink from '@/components/ui/AppLink';
import { useTranslations } from 'next-intl';

const DashMobileMenu = () => {
  const session = usePlatformSession() as any;
  const t = useTranslations('SidebarMenu');
  const { isEnabled: arePaymentsEnabled } = usePaymentsEnabled();
  const { can } = usePermissions();

  // Align visibility with route guards
  const canSeeOrg =
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.ORG);
  const canSeeCourses =
    can(Actions.CREATE, Resources.COURSE, Scopes.ORG) || can(Actions.UPDATE, Resources.COURSE, Scopes.ORG);
  const canSeeUsers =
    can(Actions.INVITE, Resources.USER, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.USER, Scopes.ORG) ||
    can(Actions.READ, Resources.USER, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.ROLE, Scopes.ORG) ||
    can(Actions.MANAGE, Resources.USERGROUP, Scopes.ORG);
  const canSeeAdmin =
    can(Actions.UPDATE, Resources.ROLE, Scopes.ORG) ||
    can(Actions.READ, Resources.ROLE, Scopes.ORG) ||
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG);
  const canSeePayments = arePaymentsEnabled && can(Actions.MANAGE, Resources.PAYMENT, Scopes.ORG);

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
        {canSeeCourses ? (
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
        ) : null}
        {canSeeCourses ? (
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
        ) : null}
        {canSeePayments ? (
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
        {canSeeUsers ? (
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
        ) : null}
        {canSeeOrg ? (
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
        {canSeeAdmin ? (
          <ToolTip
            content={t('tooltips.admin')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <AppLink
              href="/dash/admin"
              className="flex flex-col items-center p-2"
              aria-label={t('ariaLabels.admin')}
            >
              <ShieldCheck size={20} />
              <span className="mt-1 text-xs">{t('mobile.admin')}</span>
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
