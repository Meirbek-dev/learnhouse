import LegacyPage from '@/app/orgs/[orgslug]/dash/users/settings/[subpage]/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformUsersSettingsPage(props: { params: Promise<{ subpage: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
