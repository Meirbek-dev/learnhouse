import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/page';

import { withPlatformParams } from '../../legacy-route';

export default function PlatformDashCoursesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
