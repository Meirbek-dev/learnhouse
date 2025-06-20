'use client';
import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import { OrgProvider } from '@components/Contexts/OrgContext';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Auth.Layout');
  const searchParams = useSearchParams();
  const orgslug = searchParams.get('orgslug');
  if (orgslug) {
    return <OrgProvider orgslug={orgslug}>{children}</OrgProvider>;
  }
  return (
    <ErrorUI
      message={t('orgNotSpecified')}
      submessage={t('accessFromOrg')}
    />
  );
}
