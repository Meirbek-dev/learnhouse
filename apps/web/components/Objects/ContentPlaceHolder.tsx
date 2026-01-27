'use client';
import { usePermission } from '@/hooks/usePermission';
import { useTranslations } from 'next-intl';

// Terrible name and terible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const t = useTranslations('General');
  const { isAdmin: isUserAdmin } = usePermission();
  return <span>{isUserAdmin ? text : t('noContentYet')}</span>;
};

export default ContentPlaceHolderIfUserIsNotAdmin;
