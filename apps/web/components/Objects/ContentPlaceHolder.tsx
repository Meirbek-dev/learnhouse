'use client';
import { usePermissions } from '@/components/Security';
import { Actions, Resources, Scopes } from '@/types/permissions';
import { useTranslations } from 'next-intl';

// Terrible name and terrible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const t = useTranslations('General');
  const { can } = usePermissions();

  // Check if user can manage the organization (admin-like permission)
  const isAdmin = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);

  return <span>{isAdmin ? text : t('noContentYet')}</span>;
};

export default ContentPlaceHolderIfUserIsNotAdmin;
