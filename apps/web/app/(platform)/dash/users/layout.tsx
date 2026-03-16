import LegacyLayout from '@/app/orgs/[orgslug]/dash/users/layout';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformUsersLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
