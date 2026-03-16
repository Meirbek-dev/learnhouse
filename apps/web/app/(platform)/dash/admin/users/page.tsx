import LegacyPage from '@/app/orgs/[orgslug]/dash/admin/users/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformAdminUsersPage() {
  return <LegacyPage params={withPlatformParams({})} />;
}
