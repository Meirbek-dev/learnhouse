import LegacyLayout from '@/app/orgs/[orgslug]/layout';

import { withPlatformParams } from './legacy-route';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
