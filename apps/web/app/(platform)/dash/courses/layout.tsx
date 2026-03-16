import LegacyLayout from '@/app/orgs/[orgslug]/dash/courses/layout';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformCoursesLayout({ children }: { children: React.ReactNode }) {
  return <LegacyLayout params={withPlatformParams({})}>{children}</LegacyLayout>;
}
