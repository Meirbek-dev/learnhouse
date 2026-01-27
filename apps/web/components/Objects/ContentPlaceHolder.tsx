'use client';
import { useTranslations } from 'next-intl';
import { usePermission } from '@/hooks/usePermission';

// Terrible name and terible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const t = useTranslations('General');
  const { isAdmin: isUserAdmin } = usePermission();
  return <span>{isUserAdmin ? text : t('noContentYet')}</span>;
};

export default ContentPlaceHolderIfUserIsNotAdmin;
