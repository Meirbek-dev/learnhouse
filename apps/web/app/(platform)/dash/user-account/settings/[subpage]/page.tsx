import LegacyPage from '@/app/orgs/[orgslug]/dash/user-account/settings/[subpage]/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformUserSettingsPage(props: { params: Promise<{ subpage: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
