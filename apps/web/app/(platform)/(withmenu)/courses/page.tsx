import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/courses/page';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformCoursesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
