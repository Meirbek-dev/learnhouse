'use client';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslations } from 'next-intl';

// Terrible name and terible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const t = useTranslations('General');
  const { isAdmin: isUserAdmin } = usePermissions();
  return <span>{isUserAdmin ? text : t('noContentYet')}</span>;
};

export default ContentPlaceHolderIfUserIsNotAdmin;
