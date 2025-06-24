'use client';
import { useTranslations } from 'next-intl';

import useAdminStatus from '../Hooks/useAdminStatus';

// Terrible name and terible implementation, need to be refactored asap
function ContentPlaceHolderIfUserIsNotAdmin({ text }: { text: string }) {
  const t = useTranslations('General');
  const isUserAdmin = useAdminStatus() as any;
  return <span>{isUserAdmin.isAdmin ? text : t('noContentYet')}</span>;
}

export default ContentPlaceHolderIfUserIsNotAdmin;
