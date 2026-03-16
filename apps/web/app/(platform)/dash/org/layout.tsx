import LegacyLayout from '@/app/orgs/[orgslug]/dash/org/layout';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformOrgLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
