import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/collections/page';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformCollectionsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
