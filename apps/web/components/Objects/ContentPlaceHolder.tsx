'use client';
import { useTranslations } from 'next-intl';

import useAdminStatus from '../Hooks/useAdminStatus';

// Terrible name and terible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const t = useTranslations('General');
  const isUserAdmin = useAdminStatus();
  return <span>{isUserAdmin.isAdmin ? text : t('noContentYet')}</span>;
};

export default ContentPlaceHolderIfUserIsNotAdmin;
