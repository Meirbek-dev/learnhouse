import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/search/page';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformSearchPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
