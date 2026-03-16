import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/trail/page';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformTrailPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
