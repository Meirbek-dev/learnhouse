import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/page';

import { withPlatformParams } from '../legacy-route';

export default function PlatformHomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
