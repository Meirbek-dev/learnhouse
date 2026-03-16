import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformCoursePage(props: {
  params: Promise<{ courseuuid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams(props.params)} searchParams={props.searchParams} />;
}
