import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/user/[username]/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformUserPage(props: { params: Promise<{ username: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} searchParams={Promise.resolve({})} />;
}
