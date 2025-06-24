import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import ResetPasswordClient from './reset';

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
