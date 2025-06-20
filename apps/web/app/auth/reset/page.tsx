import { getTranslations } from 'next-intl/server';
import ResetPasswordClient from './reset';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.Reset');
  return {
    title: t('title'),
  };
}

function ResetPasswordPage() {
  return <ResetPasswordClient />;
}

export default ResetPasswordPage;
