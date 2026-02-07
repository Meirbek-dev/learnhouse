'use client';
import { usePermissions } from '@/components/Security';
import { Actions, Resources, Scopes } from '@/types/permissions';
import { useTranslations } from 'next-intl';

// Terrible name and terible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const t = useTranslations('General');
  const { can } = usePermissions();
  const isUserAdmin = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);
  return <span>{isUserAdmin ? text : t('noContentYet')}</span>;
};

export default ContentPlaceHolderIfUserIsNotAdmin;
