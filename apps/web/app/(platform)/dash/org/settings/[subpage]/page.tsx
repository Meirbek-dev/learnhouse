import LegacyPage from '@/app/orgs/[orgslug]/dash/org/settings/[subpage]/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformOrgSettingsPage(props: { params: Promise<{ subpage: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
