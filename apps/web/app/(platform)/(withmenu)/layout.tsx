import LegacyLayout from '@/app/orgs/[orgslug]/(withmenu)/layout';

import { withPlatformParams } from '../legacy-route';

export default function PlatformWithMenuLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
