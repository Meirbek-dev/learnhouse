import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/activity/[activityid]/page';

import { withPlatformParams } from '../../../../../legacy-route';

export default function PlatformActivityPage(props: {
  params: Promise<{ courseuuid: string; activityid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams(props.params)} searchParams={props.searchParams} />;
}
