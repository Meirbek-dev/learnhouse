import LegacyLayout from '@/app/orgs/[orgslug]/dash/assignments/layout';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformAssignmentsLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
