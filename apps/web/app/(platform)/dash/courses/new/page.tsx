import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/new/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformNewCoursePage() {
  return <LegacyPage params={withPlatformParams({})} />;
}
