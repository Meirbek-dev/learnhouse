import LegacyLayout from '@/app/orgs/[orgslug]/dash/layout';

import { withPlatformParams } from '../legacy-route';

export default function PlatformDashLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
