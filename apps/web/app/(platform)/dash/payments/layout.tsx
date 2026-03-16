import LegacyLayout from '@/app/orgs/[orgslug]/dash/payments/layout';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformPaymentsLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
