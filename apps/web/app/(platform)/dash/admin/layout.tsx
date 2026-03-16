import LegacyLayout from '@/app/orgs/[orgslug]/dash/admin/layout';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
