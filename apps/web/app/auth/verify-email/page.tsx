import type { Metadata } from 'next';

import VerifyEmailClient from './verify-email';

export const metadata: Metadata = {
  title: 'Verify Email',
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
