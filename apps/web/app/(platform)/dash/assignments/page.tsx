import LegacyPage from '@/app/orgs/[orgslug]/dash/assignments/page';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformAssignmentsPage() {
  return <LegacyPage params={withPlatformParams({})} />;
}
