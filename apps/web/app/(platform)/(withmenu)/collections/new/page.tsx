import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/collections/new/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformNewCollectionPage() {
  return <LegacyPage params={withPlatformParams({})} />;
}
